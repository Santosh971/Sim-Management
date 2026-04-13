const simService = require('../../services/sim/sim.service');
const auditLogService = require('../../services/auditLog/auditLog.service');
const { successResponse, paginatedResponse } = require('../../utils/response');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

class SimController {
  async create(req, res, next) {
    try {
      const sim = await simService.createSim(req.body, req.user);

      // Audit log: SIM_CREATE
      await auditLogService.logAction({
        action: 'SIM_CREATE',
        module: 'SIM',
        description: `Created SIM ${sim.mobileNumber} (${sim.operator})`,
        performedBy: req.user._id,
        role: req.user.role,
        companyId: sim.companyId,
        entityId: sim._id,
        entityType: 'SIM',
        metadata: { mobileNumber: sim.mobileNumber, operator: sim.operator },
        req,
      });

      return successResponse(res, sim, 'SIM created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async bulkCreate(req, res, next) {
    try {
      const { sims } = req.body;
      const result = await simService.bulkCreateSims(sims, req.user);

      // Audit log: SIM_BULK_CREATE
      await auditLogService.logAction({
        action: 'SIM_BULK_CREATE',
        module: 'SIM',
        description: `Bulk created ${result.inserted} SIMs`,
        performedBy: req.user._id,
        role: req.user.role,
        companyId: req.user.companyId,
        metadata: { inserted: result.inserted, failed: result.failed },
        req,
      });

      return successResponse(res, result, `${result.inserted} SIMs created successfully`, 201);
    } catch (error) {
      next(error);
    }
  }

  async bulkImport(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Please upload an Excel file',
        });
      }

      const { companyId } = req.body;
      const result = await simService.bulkImport(req.file, req.user, companyId);

      // Audit log: SIM_BULK_IMPORT
      await auditLogService.logAction({
        action: 'SIM_BULK_IMPORT',
        module: 'SIM',
        description: `Imported ${result.inserted} SIMs from Excel file`,
        performedBy: req.user._id,
        role: req.user.role,
        companyId: req.user.companyId,
        metadata: { inserted: result.inserted, failed: result.failed, total: result.total },
        req,
      });

      return successResponse(res, result, 'Import completed');
    } catch (error) {
      next(error);
    }
  }

  async getAll(req, res, next) {
    try {
      const result = await simService.getAllSims(req.query, req.user);
      return paginatedResponse(res, result.data, result.total, result.page, result.limit);
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const sim = await simService.getSimById(req.params.id, req.user);
      return successResponse(res, sim);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const sim = await simService.updateSim(req.params.id, req.body, req.user);

      // Audit log: SIM_UPDATE
      await auditLogService.logAction({
        action: 'SIM_UPDATE',
        module: 'SIM',
        description: `Updated SIM ${sim.mobileNumber}`,
        performedBy: req.user._id,
        role: req.user.role,
        companyId: sim.companyId,
        entityId: sim._id,
        entityType: 'SIM',
        metadata: { mobileNumber: sim.mobileNumber, changes: req.body },
        req,
      });

      return successResponse(res, sim, 'SIM updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const sim = await simService.deleteSim(req.params.id, req.user);

      // Audit log: SIM_DELETE
      await auditLogService.logAction({
        action: 'SIM_DELETE',
        module: 'SIM',
        description: `Deleted SIM ${sim.mobileNumber}`,
        performedBy: req.user._id,
        role: req.user.role,
        companyId: sim.companyId,
        entityId: sim._id,
        entityType: 'SIM',
        metadata: { mobileNumber: sim.mobileNumber },
        req,
      });

      return successResponse(res, null, 'SIM deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const { status } = req.body;
      const sim = await simService.updateStatus(req.params.id, status, req.user);

      // Audit log: SIM_STATUS_CHANGE
      await auditLogService.logAction({
        action: 'SIM_STATUS_CHANGE',
        module: 'SIM',
        description: `Changed status of SIM ${sim.mobileNumber} to ${status}`,
        performedBy: req.user._id,
        role: req.user.role,
        companyId: sim.companyId,
        entityId: sim._id,
        entityType: 'SIM',
        metadata: { mobileNumber: sim.mobileNumber, newStatus: status },
        req,
      });

      return successResponse(res, sim, 'SIM status updated');
    } catch (error) {
      next(error);
    }
  }

  async assign(req, res, next) {
    try {
      const { userId } = req.body;
      const sim = await simService.assignSim(req.params.id, userId, req.user);

      // Audit log: SIM_ASSIGN
      await auditLogService.logAction({
        action: 'SIM_ASSIGN',
        module: 'SIM',
        description: `Assigned SIM ${sim.mobileNumber} to user`,
        performedBy: req.user._id,
        role: req.user.role,
        companyId: sim.companyId,
        entityId: sim._id,
        entityType: 'SIM',
        metadata: { mobileNumber: sim.mobileNumber, assignedTo: userId },
        req,
      });

      return successResponse(res, sim, 'SIM assigned successfully');
    } catch (error) {
      next(error);
    }
  }

  async unassign(req, res, next) {
    try {
      const sim = await simService.unassignSim(req.params.id, req.user);

      // Audit log: SIM_UNASSIGN
      await auditLogService.logAction({
        action: 'SIM_UNASSIGN',
        module: 'SIM',
        description: `Unassigned SIM ${sim.mobileNumber}`,
        performedBy: req.user._id,
        role: req.user.role,
        companyId: sim.companyId,
        entityId: sim._id,
        entityType: 'SIM',
        metadata: { mobileNumber: sim.mobileNumber },
        req,
      });

      return successResponse(res, sim, 'SIM unassigned successfully');
    } catch (error) {
      next(error);
    }
  }

  async export(req, res, next) {
    try {
      const sims = await simService.exportSims(req.query, req.user);

      // Create Excel file
      const workbook = xlsx.utils.book_new();
      const data = sims.map((sim) => ({
        'Mobile Number': sim.mobileNumber,
        'Operator': sim.operator,
        'Circle': sim.circle || '',
        'Status': sim.status,
        'Assigned User Email': sim.assignedTo?.email || '',
        'Notes': sim.notes || '',
        'Created At': sim.createdAt.toISOString().split('T')[0],
      }));

      const sheet = xlsx.utils.json_to_sheet(data);
      xlsx.utils.book_append_sheet(workbook, sheet, 'SIMs');

      // Write to buffer
      const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      // Audit log: SIM_EXPORT
      await auditLogService.logAction({
        action: 'SIM_EXPORT',
        module: 'SIM',
        description: `Exported ${sims.length} SIMs to Excel`,
        performedBy: req.user._id,
        role: req.user.role,
        companyId: req.user.companyId,
        metadata: { count: sims.length },
        req,
      });

      res.setHeader('Content-Disposition', 'attachment; filename=sims-export.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-offreadml.document.spreadsheetml.sheet');
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  async getStats(req, res, next) {
    try {
      const companyId = req.user.role === 'super_admin' ? req.query.companyId : req.user.companyId;
      const stats = await simService.getSimStats(companyId);
      return successResponse(res, stats);
    } catch (error) {
      next(error);
    }
  }

  async downloadTemplate(req, res, next) {
    try {
      const workbook = await simService.generateImportTemplate();
      const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Disposition', 'attachment; filename=sim-import-template.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  async updateMessagingStatus(req, res, next) {
    try {
      const { platform, enabled } = req.body;
      const sim = await simService.updateMessagingStatus(req.params.id, platform, enabled, req.user);
      return successResponse(res, sim, `${platform} status updated`);
    } catch (error) {
      next(error);
    }
  }

  async getMessagingStats(req, res, next) {
    try {
      const companyId = req.user.role === 'super_admin' ? req.query.companyId : req.user.companyId;
      const stats = await simService.getMessagingStats(companyId);
      return successResponse(res, stats);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SimController();