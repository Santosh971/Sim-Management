const CallLog = require('../../models/callLog/callLog.model');
const Sim = require('../../models/sim/sim.model');
const { NotFoundError, ForbiddenError } = require('../../utils/errors');
// [PHONE NORMALIZATION FIX]
const { buildPhoneQuery, normalizePhoneNumber } = require('../../utils/response');
const logger = require('../../utils/logger');

class CallLogService {
  async syncCallLogs(data, user, deviceId) {
    const { simId, callLogs } = data;

    // Verify SIM exists and belongs to user's company
    const sim = await Sim.findById(simId);
    if (!sim) {
      throw new NotFoundError('SIM');
    }

    if (user.role !== 'super_admin' && sim.companyId.toString() !== user.companyId.toString()) {
      throw new ForbiddenError('Access denied to this SIM');
    }

    // Bulk upsert call logs
    const result = await CallLog.syncFromDevice(sim.companyId, simId, callLogs, deviceId);

    // Update SIM last active date
    sim.lastActiveDate = new Date();
    await sim.save();

    return result;
  }

  /**
   * Sync call logs from mobile device without JWT authentication
   * Uses mobile number to identify the SIM
   * [PHONE NORMALIZATION FIX] - Handle both phone formats for backward compatibility
   */
  async deviceSync(data, deviceId) {
    const { mobileNumber, callLogs } = data;

    if (!mobileNumber) {
      throw new Error('Mobile number is required');
    }

    if (!callLogs || !Array.isArray(callLogs) || callLogs.length === 0) {
      return { synced: 0, message: 'No call logs to sync' };
    }

    // [PHONE NORMALIZATION FIX] - Normalize and build query for backward compatibility
    const { normalized, original } = normalizePhoneNumber(mobileNumber);
    const phoneQuery = buildPhoneQuery(mobileNumber);

    if (!phoneQuery) {
      throw new Error('Invalid mobile number format');
    }

    // [PHONE NORMALIZATION FIX] - Log normalization
    logger.info('Phone number normalized for deviceSync', {
      original: original,
      normalized: normalized
    });

    // [PHONE NORMALIZATION FIX] - Find SIM by mobile number (matches both formats)
    const sim = await Sim.findOne(phoneQuery);

    if (!sim) {
      throw new NotFoundError('SIM not found with this mobile number. Please register the SIM first.');
    }

    // Get company from SIM
    const companyId = sim.companyId;

    // Bulk upsert call logs
    const result = await CallLog.syncFromDevice(companyId, sim._id, callLogs, deviceId || 'mobile');

    // Update SIM last active date
    sim.lastActiveDate = new Date();
    await sim.save();

    return result;
  }

  async getCallLogs(query, user) {
    const {
      page = 1,
      limit = 20,
      simId,
      callType,
      phoneNumber,
      startDate,
      endDate,
      sortBy = 'timestamp',
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
    if (callType) filter.callType = callType;

    if (phoneNumber) {
      filter.phoneNumber = { $regex: phoneNumber, $options: 'i' };
    }

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const callLogs = await CallLog.find(filter)
      .populate('simId', 'mobileNumber operator')
      .skip(skip)
      .limit(parseInt(limit))
      .sort(sort);

    const total = await CallLog.countDocuments(filter);

    return { data: callLogs, total, page: parseInt(page), limit: parseInt(limit) };
  }

  async getCallLogById(callLogId, user) {
    const filter = { _id: callLogId };

    if (user.role !== 'super_admin') {
      filter.companyId = user.companyId;
    }

    const callLog = await CallLog.findOne(filter).populate('simId', 'mobileNumber operator');

    if (!callLog) {
      throw new NotFoundError('Call log');
    }

    return callLog;
  }

  async getCallStats(companyId, startDate, endDate) {
    const stats = await CallLog.getStats(companyId, startDate, endDate);
    const dailyCounts = await CallLog.getDailyCounts(companyId, 30);
    const topContacts = await CallLog.getTopContacts(companyId, 10);

    return {
      ...stats,
      dailyCounts,
      topContacts,
    };
  }

  async getSimCallStats(simId, startDate, endDate) {
    const match = { simId };

    if (startDate || endDate) {
      match.timestamp = {};
      if (startDate) match.timestamp.$gte = new Date(startDate);
      if (endDate) match.timestamp.$lte = new Date(endDate);
    }

    const stats = await CallLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$callType',
          count: { $sum: 1 },
          totalDuration: { $sum: '$duration' },
          avgDuration: { $avg: '$duration' },
        },
      },
    ]);

    const totalCalls = await CallLog.countDocuments(match);
    const uniqueNumbers = await CallLog.distinct('phoneNumber', match);

    return {
      byType: stats,
      totalCalls,
      uniqueNumbers: uniqueNumbers.length,
    };
  }

  async exportCallLogs(query, user) {
    const { simId, callType, startDate, endDate } = query;

    const filter = {};

    if (user.role !== 'super_admin') {
      filter.companyId = user.companyId;
    } else if (query.companyId) {
      filter.companyId = query.companyId;
    }

    if (simId) filter.simId = simId;
    if (callType) filter.callType = callType;

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const callLogs = await CallLog.find(filter)
      .populate('simId', 'mobileNumber operator')
      .sort({ timestamp: -1 })
      .limit(10000);

    return callLogs;
  }

  async flagCallLog(callLogId, flagged, reason, user) {
    const filter = { _id: callLogId };

    if (user.role !== 'super_admin') {
      filter.companyId = user.companyId;
    }

    const callLog = await CallLog.findOneAndUpdate(
      filter,
      {
        isFlagged: flagged,
        flaggedReason: flagged ? reason : null,
      },
      { new: true }
    );

    if (!callLog) {
      throw new NotFoundError('Call log');
    }

    return callLog;
  }

  async deleteOldCallLogs(companyId, daysToKeep = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await CallLog.deleteMany({
      companyId,
      timestamp: { $lt: cutoffDate },
    });

    return { deletedCount: result.deletedCount };
  }
}

module.exports = new CallLogService();