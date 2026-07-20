const ActivityLog = require('../Model/activityLogModel');

const logActivity = async ({
  action,
  actorId,
  companyId,
  targetType,
  targetId,
  metadata,
}) => {
  const log = await ActivityLog.create({
    action,
    actor: actorId,
    company: companyId,
    targetType,
    targetId,
    metadata,
  });
  return log;
};

module.exports = { logActivity };
