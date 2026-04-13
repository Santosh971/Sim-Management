const Recharge = require('../../models/recharge/recharge.model');
const Sim = require('../../models/sim/sim.model');
const Company = require('../../models/company/company.model');
const Notification = require('../../models/notification/notification.model');
const { NotFoundError, ForbiddenError } = require('../../utils/errors');

class RechargeService {
  async createRecharge(data, user) {
    const { simId, amount, validity, plan, rechargeDate, paymentMethod, transactionId, notes } = data;

    // Get SIM
    const sim = await Sim.findById(simId);
    if (!sim) {
      throw new NotFoundError('SIM');
    }

    // Check access
    if (user.role !== 'super_admin' && sim.companyId.toString() !== user.companyId.toString()) {
      throw new ForbiddenError('Access denied to this SIM');
    }

    // Create recharge
    const recharge = new Recharge({
      companyId: sim.companyId,
      simId,
      amount,
      validity: validity || 28,
      plan,
      rechargeDate: rechargeDate || new Date(),
      paymentMethod: paymentMethod || 'cash',
      transactionId,
      notes,
      createdBy: user.id,
    });

    await recharge.save();

    // Update SIM last active date
    sim.lastActiveDate = new Date();
    await sim.save();

    // Update company stats
    await this.updateCompanyStats(sim.companyId);

    return recharge.populate('simId', 'mobileNumber operator');
  }

  async getAllRecharges(query, user) {
    const {
      page = 1,
      limit = 10,
      simId,
      status,
      startDate,
      endDate,
      sortBy = 'rechargeDate',
      sortOrder = 'desc',
    } = query;

    const filter = {};

    // Data isolation
    if (user.role !== 'super_admin') {
      filter.companyId = user.companyId;
    } else if (query.companyId) {
      filter.companyId = query.companyId;
    }

    if (simId) filter.simId = simId;
    if (status) filter.status = status;

    if (startDate || endDate) {
      filter.rechargeDate = {};
      if (startDate) filter.rechargeDate.$gte = new Date(startDate);
      if (endDate) filter.rechargeDate.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const recharges = await Recharge.find(filter)
      .populate('simId', 'mobileNumber operator status')
      .populate('createdBy', 'name')
      .skip(skip)
      .limit(parseInt(limit))
      .sort(sort);

    const total = await Recharge.countDocuments(filter);

    return { data: recharges, total, page: parseInt(page), limit: parseInt(limit) };
  }

  async getRechargeById(rechargeId, user) {
    const filter = { _id: rechargeId };

    if (user.role !== 'super_admin') {
      filter.companyId = user.companyId;
    }

    const recharge = await Recharge.findOne(filter)
      .populate('simId', 'mobileNumber operator status')
      .populate('createdBy', 'name');

    if (!recharge) {
      throw new NotFoundError('Recharge');
    }

    return recharge;
  }

  async updateRecharge(rechargeId, updateData, user) {
    const filter = { _id: rechargeId };

    if (user.role !== 'super_admin') {
      filter.companyId = user.companyId;
    }

    const allowedUpdates = ['amount', 'validity', 'plan', 'notes', 'status'];
    const updates = {};

    Object.keys(updateData).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updates[key] = updateData[key];
      }
    });

    const recharge = await Recharge.findOneAndUpdate(filter, updates, {
      new: true,
      runValidators: true,
    }).populate('simId', 'mobileNumber operator');

    if (!recharge) {
      throw new NotFoundError('Recharge');
    }

    return recharge;
  }

  async deleteRecharge(rechargeId, user) {
    const filter = { _id: rechargeId };

    if (user.role !== 'super_admin') {
      filter.companyId = user.companyId;
    }

    const recharge = await Recharge.findOneAndDelete(filter);

    if (!recharge) {
      throw new NotFoundError('Recharge');
    }

    // Update company stats
    await this.updateCompanyStats(recharge.companyId);

    return true;
  }

  async getUpcomingRecharges(companyId, days = 7) {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const recharges = await Recharge.find({
      companyId,
      nextRechargeDate: {
        $gte: now,
        $lte: futureDate,
      },
      status: 'completed',
      reminderSent: false,
    })
      .populate('simId', 'mobileNumber operator status')
      .sort({ nextRechargeDate: 1 });

    return recharges;
  }

  async getOverdueRecharges(companyId) {
    return Recharge.find({
      companyId,
      nextRechargeDate: { $lt: new Date() },
      status: 'completed',
    })
      .populate('simId', 'mobileNumber operator status')
      .sort({ nextRechargeDate: 1 });
  }

  async getSimRechargeHistory(simId, limit = 10) {
    return Recharge.find({ simId, status: 'completed' })
      .sort({ rechargeDate: -1 })
      .limit(limit);
  }

  async getRechargeStats(companyId, startDate, endDate) {
    const query = { companyId, status: 'completed' };

    if (startDate || endDate) {
      query.rechargeDate = {};
      if (startDate) query.rechargeDate.$gte = new Date(startDate);
      if (endDate) query.rechargeDate.$lte = new Date(endDate);
    }

    const stats = await Recharge.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' },
          minAmount: { $min: '$amount' },
          maxAmount: { $max: '$amount' },
        },
      },
    ]);

    const monthlyStats = await Recharge.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            year: { $year: '$rechargeDate' },
            month: { $month: '$rechargeDate' },
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 },
    ]);

    return {
      overall: stats[0] || { totalAmount: 0, count: 0, avgAmount: 0 },
      monthly: monthlyStats,
    };
  }

  async processReminders() {
    const companies = await Company.find({ isActive: true });

    let remindersSent = 0;

    for (const company of companies) {
      const upcomingRecharges = await this.getUpcomingRecharges(
        company._id,
        company.settings.rechargeReminderDays || 3
      );

      for (const recharge of upcomingRecharges) {
        const daysLeft = Math.ceil(
          (recharge.nextRechargeDate - new Date()) / (1000 * 60 * 60 * 24)
        );

        await Notification.createRechargeReminder(company, recharge.simId, recharge, daysLeft);

        recharge.reminderSent = true;
        recharge.reminderSentAt = new Date();
        await recharge.save();

        remindersSent++;
      }
    }

    return { remindersSent };
  }

  async updateCompanyStats(companyId) {
    const totalRecharges = await Recharge.countDocuments({
      companyId,
      status: 'completed',
    });

    const stats = await Recharge.getTotalSpent(companyId);

    await Company.findByIdAndUpdate(companyId, {
      'stats.totalRecharges': totalRecharges,
      'stats.totalSpent': stats.total,
    });
  }
}

module.exports = new RechargeService();