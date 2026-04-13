const Sim = require('../../models/sim/sim.model');
const User = require('../../models/auth/user.model');
const Company = require('../../models/company/company.model');
const mongoose = require('mongoose');
const { NotFoundError, ConflictError, ForbiddenError, ValidationError } = require('../../utils/errors');
const notificationHelper = require('../../utils/notificationHelper');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

class SimService {
  async createSim(data, user) {
    const { mobileNumber, operator, companyId, assignedTo } = data;

    // Determine companyId
    const targetCompanyId = user.role === 'super_admin' ? companyId : user.companyId;

    if (!targetCompanyId) {
      throw new ForbiddenError('Company ID is required');
    }

    // Check if mobile number exists
    const existingMobile = await Sim.findOne({ mobileNumber, companyId: targetCompanyId });
    if (existingMobile) {
      throw new ConflictError('Mobile number already exists in your company');
    }

    // Validate assignedTo if provided
    if (assignedTo) {
      const assignedUser = await User.findById(assignedTo);
      if (!assignedUser || assignedUser.companyId.toString() !== targetCompanyId.toString()) {
        throw new ValidationError('Invalid user assignment. User must belong to the same company.');
      }
    }

    const sim = new Sim({
      ...data,
      companyId: targetCompanyId,
      createdBy: user.id,
      assignedTo: assignedTo || null,
    });

    await sim.save();

    // Update company stats
    await this.updateCompanyStats(targetCompanyId);

    return sim;
  }

  async bulkCreateSims(simsData, user) {
    const targetCompanyId = user.role === 'super_admin' ? simsData[0]?.companyId : user.companyId;

    if (!targetCompanyId) {
      throw new ForbiddenError('Company ID is required');
    }

    const validOperators = ['Jio', 'Airtel', 'Vi', 'BSNL', 'MTNL', 'Other'];
    const validStatuses = ['active', 'inactive', 'suspended', 'lost'];
    const errors = [];
    const simsToInsert = [];
    const mobileNumbers = simsData.map(s => s.mobileNumber);

    // Check for duplicate mobile numbers within the batch
    const duplicates = mobileNumbers.filter((item, index) => mobileNumbers.indexOf(item) !== index);
    if (duplicates.length > 0) {
      throw new ValidationError(`Duplicate mobile numbers in batch: ${[...new Set(duplicates)].join(', ')}`);
    }

    // Check existing mobile numbers
    const existingSims = await Sim.find({
      mobileNumber: { $in: mobileNumbers },
      companyId: targetCompanyId,
    });

    const existingMobileNumbers = existingSims.map(s => s.mobileNumber);

    // Collect unique emails for user lookup
    const emails = simsData
      .map(s => s.assignedUserEmail)
      .filter(email => email && email.trim() !== '')
      .map(email => email.toLowerCase());

    const uniqueEmails = [...new Set(emails)];

    // Look up users by email
    let userEmailMap = {};
    if (uniqueEmails.length > 0) {
      const users = await User.find({
        email: { $in: uniqueEmails },
        companyId: targetCompanyId,
        isActive: true,
      }).select('_id email');

      userEmailMap = users.reduce((map, u) => {
        map[u.email.toLowerCase()] = u._id;
        return map;
      }, {});
    }

    for (let i = 0; i < simsData.length; i++) {
      const row = simsData[i];
      const rowErrors = [];

      // Validate mobile number
      if (!row.mobileNumber || !/^\d{10}$/.test(row.mobileNumber)) {
        rowErrors.push('Invalid 10-digit mobile number');
      }

      // Validate operator
      if (row.operator && !validOperators.includes(row.operator)) {
        rowErrors.push(`Invalid operator. Must be one of: ${validOperators.join(', ')}`);
      }

      // Validate status
      if (row.status && !validStatuses.includes(row.status)) {
        rowErrors.push(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }

      // Check if mobile number already exists
      if (existingMobileNumbers.includes(row.mobileNumber)) {
        rowErrors.push('Mobile number already exists');
      }

      // Validate assigned user email
      let assignedTo = null;
      if (row.assignedUserEmail && row.assignedUserEmail.trim() !== '') {
        const email = row.assignedUserEmail.toLowerCase();
        if (!userEmailMap[email]) {
          rowErrors.push('Assigned user email not found in your company');
        } else {
          assignedTo = userEmailMap[email];
        }
      }

      if (rowErrors.length > 0) {
        errors.push({ row: i + 1, mobileNumber: row.mobileNumber, errors: rowErrors });
      } else {
        simsToInsert.push({
          mobileNumber: row.mobileNumber,
          operator: row.operator || 'Jio',
          circle: row.circle || '',
          status: row.status || 'active',
          notes: row.notes || '',
          assignedTo: assignedTo,
          companyId: targetCompanyId,
          createdBy: user.id,
          isActive: true,
          whatsappEnabled: false,
          telegramEnabled: false,
        });
      }
    }

    if (errors.length > 0) {
      // throw new ValidationError('Validation errors', { errors });
      throw new ValidationError(errors);
    }

    // Bulk insert
    const result = await Sim.insertMany(simsToInsert, { ordered: false });

    // Update company stats
    await this.updateCompanyStats(targetCompanyId);

    return {
      inserted: result.length,
      total: simsData.length,
    };
  }

  async bulkImport(file, user, companyId) {
    const targetCompanyId = user.role === 'super_admin' ? companyId : user.companyId;

    if (!targetCompanyId) {
      throw new ForbiddenError('Company ID is required');
    }

    // Read Excel file
    const workbook = xlsx.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    const results = {
      success: [],
      failed: [],
      total: data.length,
    };

    for (const row of data) {
      try {
        const mobileNumber = row['Mobile Number'] || row.mobileNumber || row.mobile_number;
        const assignedUserEmail = row['Assigned User Email'] || row.assignedUserEmail || row.assigned_user_email || '';

        const simData = {
          mobileNumber: mobileNumber,
          operator: row['Operator'] || row.operator || 'Jio',
          circle: row['Circle'] || row.circle || '',
          notes: row['Notes'] || row.notes || '',
          status: row['Status'] || row.status || 'active',
          companyId: targetCompanyId,
          createdBy: user.id,
        };

        if (!simData.mobileNumber) {
          throw new Error('Missing mobile number');
        }

        // Check duplicates
        const existing = await Sim.findOne({
          mobileNumber: simData.mobileNumber,
          companyId: targetCompanyId,
        });

        if (existing) {
          throw new Error('Mobile number already exists');
        }

        // Handle assigned user by email
        if (assignedUserEmail && assignedUserEmail.trim() !== '') {
          const assignedUser = await User.findOne({
            email: assignedUserEmail.toLowerCase(),
            companyId: targetCompanyId,
            isActive: true,
          });

          if (assignedUser) {
            simData.assignedTo = assignedUser._id;
          }
        }

        const sim = new Sim(simData);
        await sim.save();
        results.success.push(sim);
      } catch (error) {
        results.failed.push({
          row,
          error: error.message,
        });
      }
    }

    // Update company stats
    await this.updateCompanyStats(targetCompanyId);

    // Cleanup file
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    return results;
  }

  async getAllSims(query, user) {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      operator,
      assignedTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const filter = { isActive: true };

    // Data isolation
    if (user.role !== 'super_admin') {
      filter.companyId = user.companyId;
    } else if (query.companyId) {
      filter.companyId = query.companyId;
    }

    if (search) {
      filter.$or = [
        { mobileNumber: { $regex: search, $options: 'i' } },
        { operator: { $regex: search, $options: 'i' } },
      ];
    }

    if (status) filter.status = status;
    if (operator) filter.operator = operator;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (assignedTo === 'unassigned') filter.assignedTo = null;

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const sims = await Sim.find(filter)
      .populate('assignedTo', 'name email')
      .populate('companyId', 'name')
      .skip(skip)
      .limit(parseInt(limit))
      .sort(sort);

    const total = await Sim.countDocuments(filter);

    return { data: sims, total, page: parseInt(page), limit: parseInt(limit) };
  }

  async getSimById(simId, user) {
    const filter = { _id: simId, isActive: true };

    if (user.role !== 'super_admin') {
      filter.companyId = user.companyId;
    }

    const sim = await Sim.findOne(filter)
      .populate('assignedTo', 'name email phone')
      .populate('companyId', 'name email');

    if (!sim) {
      throw new NotFoundError('SIM');
    }

    return sim;
  }

  async updateSim(simId, updateData, user) {
    const filter = { _id: simId, isActive: true };

    if (user.role !== 'super_admin') {
      filter.companyId = user.companyId;
    }

    const allowedUpdates = ['mobileNumber', 'operator', 'circle', 'assignedTo', 'status', 'plan', 'notes', 'tags'];
    const updates = {};

    Object.keys(updateData).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updates[key] = updateData[key];
      }
    });

    // Validate assignedTo if provided
    if (updates.assignedTo !== undefined && updates.assignedTo !== null && updates.assignedTo !== '') {
      const assignedUser = await User.findById(updates.assignedTo);
      const companyIdForCheck = user.role === 'super_admin' ? filter.companyId : user.companyId;
      if (!assignedUser || (companyIdForCheck && assignedUser.companyId.toString() !== companyIdForCheck.toString())) {
        throw new ValidationError('Invalid user assignment. User must belong to the same company.');
      }
    }

    // Handle empty string as unassign
    if (updates.assignedTo === '') {
      updates.assignedTo = null;
    }

    if (updates.status === 'inactive') {
      updates.deactivationDate = new Date();
    }

    const sim = await Sim.findOneAndUpdate(filter, updates, {
      new: true,
      runValidators: true,
    }).populate('assignedTo', 'name email');

    if (!sim) {
      throw new NotFoundError('SIM');
    }

    return sim;
  }

  async deleteSim(simId, user) {
    const filter = { _id: simId };

    if (user.role !== 'super_admin') {
      filter.companyId = user.companyId;
    }

    const sim = await Sim.findOneAndDelete(filter);

    if (!sim) {
      throw new NotFoundError('SIM');
    }

    // Update company stats
    const companyId = sim.companyId;
    await this.updateCompanyStats(companyId);

    return true;
  }

  async updateStatus(simId, status, user) {
    const filter = { _id: simId, isActive: true };

    if (user.role !== 'super_admin') {
      filter.companyId = user.companyId;
    }

    const updates = { status };
    if (status === 'inactive') {
      updates.deactivationDate = new Date();
    } else if (status === 'active') {
      updates.activationDate = new Date();
      updates.lastActiveDate = new Date();
    }

    const sim = await Sim.findOneAndUpdate(filter, updates, { new: true });

    if (!sim) {
      throw new NotFoundError('SIM');
    }

    return sim;
  }

  async assignSim(simId, userId, user) {
    const filter = { _id: simId, isActive: true };

    if (user.role !== 'super_admin') {
      filter.companyId = user.companyId;
    }

    // Verify user exists and belongs to same company
    const targetUser = await User.findById(userId);
    if (!targetUser || (user.role !== 'super_admin' && targetUser.companyId.toString() !== user.companyId.toString())) {
      throw new NotFoundError('User');
    }

    const sim = await Sim.findOneAndUpdate(
      filter,
      { assignedTo: userId },
      { new: true }
    ).populate('assignedTo', 'name email');

    if (!sim) {
      throw new NotFoundError('SIM');
    }

    // Send notification to assigned user
    try {
      const company = await Company.findById(sim.companyId);
      await notificationHelper.notifySimAssigned(sim, targetUser, user, company);
    } catch (notificationError) {
      // Don't fail assignment if notification fails
      console.error('Failed to send SIM assignment notification:', notificationError.message);
    }

    return sim;
  }

  async unassignSim(simId, user) {
    const filter = { _id: simId, isActive: true };

    if (user.role !== 'super_admin') {
      filter.companyId = user.companyId;
    }

    const sim = await Sim.findOneAndUpdate(
      filter,
      { assignedTo: null },
      { new: true }
    );

    if (!sim) {
      throw new NotFoundError('SIM');
    }

    return sim;
  }

  async exportSims(query, user) {
    const { search, status, operator } = query;

    const filter = { isActive: true };

    if (user.role !== 'super_admin') {
      filter.companyId = user.companyId;
    } else if (query.companyId) {
      filter.companyId = query.companyId;
    }

    if (search) {
      filter.$or = [
        { mobileNumber: { $regex: search, $options: 'i' } },
        { operator: { $regex: search, $options: 'i' } },
      ];
    }

    if (status) filter.status = status;
    if (operator) filter.operator = operator;

    const sims = await Sim.find(filter)
      .populate('assignedTo', 'name email')
      .populate('companyId', 'name')
      .sort({ createdAt: -1 });

    return sims;
  }

  async getSimStats(companyId) {
    const totalSims = await Sim.countDocuments({ companyId, isActive: true });
    const activeSims = await Sim.countDocuments({ companyId, isActive: true, status: 'active' });
    const inactiveSims = await Sim.countDocuments({ companyId, isActive: true, status: 'inactive' });
    const suspendedSims = await Sim.countDocuments({ companyId, isActive: true, status: 'suspended' });

    const operatorStats = await Sim.aggregate([
      { $match: { companyId: companyId, isActive: true } },
      { $group: { _id: '$operator', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    return {
      total: totalSims,
      active: activeSims,
      inactive: inactiveSims,
      suspended: suspendedSims,
      byOperator: operatorStats,
    };
  }

  async updateCompanyStats(companyId) {
    const totalSims = await Sim.countDocuments({ companyId, isActive: true });
    const activeSims = await Sim.countDocuments({ companyId, isActive: true, status: 'active' });

    await Company.findByIdAndUpdate(companyId, {
      'stats.totalSims': totalSims,
      'stats.activeSims': activeSims,
    });
  }

  async generateImportTemplate() {
    const template = [
      {
        'Mobile Number': '9876543210',
        'Operator': 'Jio',
        'Circle': 'Maharashtra',
        'Status': 'active',
        'Assigned User Email': 'user@example.com',
        'Notes': 'Optional notes',
      },
    ];

    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.json_to_sheet(template);
    xlsx.utils.book_append_sheet(workbook, sheet, 'SIM Import');

    return workbook;
  }

  async updateMessagingStatus(simId, platform, enabled, user) {
    const validPlatforms = ['whatsapp', 'telegram'];
    if (!validPlatforms.includes(platform)) {
      throw new ValidationError('Invalid platform. Use whatsapp or telegram');
    }

    const filter = { _id: simId };
    if (user.role !== 'super_admin') {
      filter.companyId = user.companyId;
    }

    const updateField = `${platform}Enabled`;
    const lastActiveField = `${platform}LastActive`;

    const sim = await Sim.findOneAndUpdate(
      filter,
      {
        [updateField]: enabled,
        [lastActiveField]: enabled ? new Date() : null,
      },
      { new: true }
    ).populate('companyId', 'name').populate('assignedTo', 'name email');

    if (!sim) {
      throw new NotFoundError('SIM');
    }

    return sim;
  }

  async getMessagingStats(companyId) {
    const stats = await Sim.aggregate([
      { $match: { companyId: new mongoose.Types.ObjectId(companyId) } },
      {
        $group: {
          _id: null,
          totalSims: { $sum: 1 },
          whatsappEnabled: { $sum: { $cond: ['$whatsappEnabled', 1, 0] } },
          telegramEnabled: { $sum: { $cond: ['$telegramEnabled', 1, 0] } },
          bothEnabled: {
            $sum: {
              $cond: [
                { $and: ['$whatsappEnabled', '$telegramEnabled'] },
                1,
                0,
              ],
            },
          },
          neitherEnabled: {
            $sum: {
              $cond: [
                { $and: [{ $not: '$whatsappEnabled' }, { $not: '$telegramEnabled' }] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    // Get active messaging SIMs (with last active in last 24 hours)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setDate(twentyFourHoursAgo.getDate() - 1);

    const activeStats = await Sim.aggregate([
      { $match: { companyId: new mongoose.Types.ObjectId(companyId) } },
      {
        $group: {
          _id: null,
          whatsappActiveRecently: {
            $sum: {
              $cond: [
                {
                  $and: [
                    '$whatsappEnabled',
                    { $gte: ['$whatsappLastActive', twentyFourHoursAgo] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          telegramActiveRecently: {
            $sum: {
              $cond: [
                {
                  $and: [
                    '$telegramEnabled',
                    { $gte: ['$telegramLastActive', twentyFourHoursAgo] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    return {
      total: stats[0]?.totalSims || 0,
      whatsapp: {
        enabled: stats[0]?.whatsappEnabled || 0,
        activeRecently: activeStats[0]?.whatsappActiveRecently || 0,
      },
      telegram: {
        enabled: stats[0]?.telegramEnabled || 0,
        activeRecently: activeStats[0]?.telegramActiveRecently || 0,
      },
      both: stats[0]?.bothEnabled || 0,
      neither: stats[0]?.neitherEnabled || 0,
    };
  }
}

module.exports = new SimService();