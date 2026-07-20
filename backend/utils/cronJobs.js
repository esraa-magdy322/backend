const cron = require('node-cron');
const Company = require('../Model/companyModel');
const Subscription = require('../Model/subscriptionModel');

const startCronJobs = () => {
  // Run every day at midnight (00:00)
  cron.schedule('0 0 * * *', async () => {
    console.log('Running daily cron job to check company subscriptions...');
    try {
      const currentDate = new Date();
      
      const expiredSubscriptions = await Subscription.find({
        endDate: { $lt: currentDate },
        status: { $ne: 'Expired' }
      });

      for (const sub of expiredSubscriptions) {
        sub.status = 'Expired';
        await sub.save();

        const company = await Company.findById(sub.company);
        if (company && company.status === 'active') {
          company.status = 'suspended';
          company.subscriptionStatus = 'Expired';
          await company.save();
          console.log(`Suspended company: ${company.name} due to subscription expiration.`);
        }
      }
      
      console.log('Daily cron job finished successfully.');
    } catch (error) {
      console.error('Error in daily cron job:', error);
    }
  });
};

module.exports = { startCronJobs };
