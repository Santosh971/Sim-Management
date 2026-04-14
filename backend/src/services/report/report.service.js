const Sim = require('../../models/sim/sim.model');
const Recharge = require('../../models/recharge/recharge.model');
const CallLog = require('../../models/callLog/callLog.model');
const Company = require('../../models/company/company.model');
const User = require('../../models/auth/user.model');
const xlsx = require('xlsx');
const mongoose = require('mongoose');

class ReportService {
  // SIM Report
  async generateSimReport(query, user) {
    const { startDate, endDate, status, operator, format = 'json' } = query;

    const filter = {};

    // Data isolation
    if (user.role !== 'super_admin') {
      filter.companyId = new mongoose.Types.ObjectId(user.companyId);
    } else if (query.companyId) {
      filter.companyId = new mongoose.Types.ObjectId(query.companyId);
    }

    if (status) filter.status = status;
    if (operator) filter.operator = operator;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const sims = await Sim.find(filter)
      .populate('companyId', 'name')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    // Calculate summary
    const summary = {
      total: sims.length,
      byStatus: {},
      byOperator: {},
      whatsappEnabled: 0,
      telegramEnabled: 0,
    };

    sims.forEach(sim => {
      summary.byStatus[sim.status] = (summary.byStatus[sim.status] || 0) + 1;
      summary.byOperator[sim.operator] = (summary.byOperator[sim.operator] || 0) + 1;
      if (sim.whatsappEnabled) summary.whatsappEnabled++;
      if (sim.telegramEnabled) summary.telegramEnabled++;
    });

    return { data: sims, summary };
  }

  // Recharge Report
  async generateRechargeReport(query, user) {
    const { startDate, endDate, simId, format = 'json' } = query;

    const filter = { status: 'completed' };

    // Data isolation
    if (user.role !== 'super_admin') {
      filter.companyId = new mongoose.Types.ObjectId(user.companyId);
    } else if (query.companyId) {
      filter.companyId = new mongoose.Types.ObjectId(query.companyId);
    }

    if (simId) filter.simId = new mongoose.Types.ObjectId(simId);

    if (startDate || endDate) {
      filter.rechargeDate = {};
      if (startDate) filter.rechargeDate.$gte = new Date(startDate);
      if (endDate) filter.rechargeDate.$lte = new Date(endDate);
    }

    const recharges = await Recharge.find(filter)
      .populate('simId', 'mobileNumber operator')
      .populate('companyId', 'name')
      .populate('createdBy', 'name')
      .sort({ rechargeDate: -1 })
      .lean();

    // Calculate summary
    const summary = {
      total: recharges.length,
      totalAmount: recharges.reduce((sum, r) => sum + (r.amount || 0), 0),
      avgAmount: recharges.length > 0 ? recharges.reduce((sum, r) => sum + (r.amount || 0), 0) / recharges.length : 0,
      byPaymentMethod: {},
      byOperator: {},
    };

    recharges.forEach(r => {
      const method = r.paymentMethod || 'other';
      summary.byPaymentMethod[method] = (summary.byPaymentMethod[method] || 0) + 1;

      const operator = r.simId?.operator || 'Unknown';
      summary.byOperator[operator] = (summary.byOperator[operator] || 0) + 1;
    });

    return { data: recharges, summary };
  }

  // Call Log Report
  async generateCallLogReport(query, user) {
    const { startDate, endDate, simId, callType, format = 'json' } = query;

    const filter = {};

    // Data isolation
    if (user.role !== 'super_admin') {
      filter.companyId = new mongoose.Types.ObjectId(user.companyId);
    } else if (query.companyId) {
      filter.companyId = new mongoose.Types.ObjectId(query.companyId);
    }

    if (simId) filter.simId = new mongoose.Types.ObjectId(simId);
    if (callType) filter.callType = callType;

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const callLogs = await CallLog.find(filter)
      .populate('simId', 'mobileNumber operator')
      .sort({ timestamp: -1 })
      .limit(10000)
      .lean();

    // Calculate summary
    const summary = {
      total: callLogs.length,
      totalDuration: callLogs.reduce((sum, c) => sum + (c.duration || 0), 0),
      avgDuration: callLogs.length > 0 ? callLogs.reduce((sum, c) => sum + (c.duration || 0), 0) / callLogs.length : 0,
      byType: {},
      uniqueNumbers: new Set(callLogs.map(c => c.phoneNumber)).size,
    };

    callLogs.forEach(c => {
      summary.byType[c.callType] = (summary.byType[c.callType] || 0) + 1;
    });

    return { data: callLogs, summary };
  }

  // Company Report (Super Admin)
  async generateCompanyReport(query) {
    const { startDate, endDate, isActive, format = 'json' } = query;

    const filter = {};

    if (isActive !== undefined) filter.isActive = isActive === 'true';

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const companies = await Company.find(filter)
      .populate('subscriptionId', 'name price')
      .sort({ createdAt: -1 })
      .lean();

    // Get additional stats for each company
    const companyStats = await Promise.all(
      companies.map(async (company) => {
        const simCount = await Sim.countDocuments({ companyId: company._id, isActive: true });
        const rechargeTotal = await Recharge.aggregate([
          { $match: { companyId: company._id, status: 'completed' } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);

        return {
          ...company,
          stats: {
            totalSims: simCount,
            totalRechargeAmount: rechargeTotal[0]?.total || 0,
          },
        };
      })
    );

    const summary = {
      total: companies.length,
      active: companies.filter(c => c.isActive).length,
      inactive: companies.filter(c => !c.isActive).length,
      totalSims: companyStats.reduce((sum, c) => sum + c.stats.totalSims, 0),
      totalRevenue: companyStats.reduce((sum, c) => sum + c.stats.totalRechargeAmount, 0),
    };

    return { data: companyStats, summary };
  }

  // Export to Excel
  async exportToExcel(data, reportType) {
    const workbook = xlsx.utils.book_new();

    // Add data sheet
    const dataSheet = this.createDataSheet(data.data, reportType);
    xlsx.utils.book_append_sheet(workbook, dataSheet, 'Data');

    // Add summary sheet
    const summarySheet = this.createSummarySheet(data.summary, reportType);
    xlsx.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    return workbook;
  }

  createDataSheet(data, reportType) {
    let headers = [];
    let rows = [];

    switch (reportType) {
      case 'sims':
        headers = ['Mobile Number', 'Operator', 'Circle', 'Status', 'WhatsApp', 'Telegram', 'Assigned To', 'Created'];
        rows = data.map(item => [
          item.mobileNumber,
          item.operator,
          item.circle || '',
          item.status,
          item.whatsappEnabled ? 'Yes' : 'No',
          item.telegramEnabled ? 'Yes' : 'No',
          item.assignedTo?.name || 'Unassigned',
          new Date(item.createdAt).toLocaleDateString(),
        ]);
        break;

      case 'recharges':
        headers = ['Mobile Number', 'Operator', 'Amount', 'Validity', 'Plan', 'Payment Method', 'Date', 'Next Recharge'];
        rows = data.map(item => [
          item.simId?.mobileNumber || 'N/A',
          item.simId?.operator || 'N/A',
          item.amount,
          `${item.validity} days`,
          item.plan?.name || 'N/A',
          item.paymentMethod,
          new Date(item.rechargeDate).toLocaleDateString(),
          new Date(item.nextRechargeDate).toLocaleDateString(),
        ]);
        break;

      case 'callLogs':
        headers = ['Phone Number', 'Call Type', 'Duration (s)', 'SIM', 'Contact Name', 'Date'];
        rows = data.map(item => [
          item.phoneNumber,
          item.callType,
          item.duration,
          item.simId?.mobileNumber || 'N/A',
          item.contactName || '',
          new Date(item.timestamp).toLocaleString(),
        ]);
        break;

      case 'companies':
        headers = ['Company Name', 'Email', 'Status', 'Subscription', 'SIMs', 'Revenue', 'Created'];
        rows = data.map(item => [
          item.name,
          item.email,
          item.isActive ? 'Active' : 'Inactive',
          item.subscriptionId?.name || 'N/A',
          item.stats?.totalSims || 0,
          item.stats?.totalRechargeAmount || 0,
          new Date(item.createdAt).toLocaleDateString(),
        ]);
        break;
    }

    const sheetData = [headers, ...rows];
    return xlsx.utils.aoa_to_sheet(sheetData);
  }

  createSummarySheet(summary, reportType) {
    const rows = [['Summary Report'], [''], ['Metric', 'Value']];

    Object.entries(summary).forEach(([key, value]) => {
      if (typeof value === 'object') {
        rows.push([key.replace(/([A-Z])/g, ' $1').trim(), '']);
        Object.entries(value).forEach(([k, v]) => {
          rows.push([`  ${k}`, v]);
        });
      } else {
        rows.push([key.replace(/([A-Z])/g, ' $1').trim(), value]);
      }
    });

    return xlsx.utils.aoa_to_sheet(rows);
  }

  // Export to CSV
  async exportToCsv(data, reportType) {
    const headers = this.getHeaders(reportType);
    const rows = data.map(item => this.formatRow(item, reportType));

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  getHeaders(reportType) {
    const headerMap = {
      sims: ['Mobile Number', 'Operator', 'Circle', 'Status', 'WhatsApp', 'Telegram', 'Assigned To', 'Created'],
      recharges: ['Mobile Number', 'Operator', 'Amount', 'Validity', 'Plan', 'Payment Method', 'Date', 'Next Recharge'],
      callLogs: ['Phone Number', 'Call Type', 'Duration', 'SIM', 'Contact Name', 'Date'],
      companies: ['Company Name', 'Email', 'Status', 'Subscription', 'SIMs', 'Revenue', 'Created'],
    };
    return headerMap[reportType] || [];
  }

  formatRow(item, reportType) {
    switch (reportType) {
      case 'sims':
        return [
          item.mobileNumber,

          item.operator,
          item.circle || '',
          item.status,
          item.whatsappEnabled ? 'Yes' : 'No',
          item.telegramEnabled ? 'Yes' : 'No',
          item.assignedTo?.name || 'Unassigned',
          new Date(item.createdAt).toLocaleDateString(),
        ];
      case 'recharges':
        return [
          item.simId?.mobileNumber || 'N/A',
          item.simId?.operator || 'N/A',
          item.amount,
          `${item.validity} days`,
          item.plan?.name || 'N/A',
          item.paymentMethod,
          new Date(item.rechargeDate).toLocaleDateString(),
          new Date(item.nextRechargeDate).toLocaleDateString(),
        ];
      case 'callLogs':
        return [
          item.phoneNumber,
          item.callType,
          item.duration,
          item.simId?.mobileNumber || 'N/A',
          item.contactName || '',
          new Date(item.timestamp).toLocaleString(),
        ];
      case 'companies':
        return [
          item.name,
          item.email,
          item.isActive ? 'Active' : 'Inactive',
          item.subscriptionId?.name || 'N/A',
          item.stats?.totalSims || 0,
          item.stats?.totalRechargeAmount || 0,
          new Date(item.createdAt).toLocaleDateString(),
        ];
      default:
        return [];
    }
  }
}

module.exports = new ReportService();