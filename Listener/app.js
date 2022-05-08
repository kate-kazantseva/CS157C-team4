const redis = require('redis');
const mailer = require('nodemailer');

let client = redis.createClient(6379, '127.0.0.1');
const subscriber = client.duplicate();
subscriber.connect();
client.connect();

(async () => {
    await subscriber.subscribe('ch:mountain_view_ca', (message) => {
      notify(message);
    });
})();

var transporter = mailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'jobsearchproj@gmail.com',
      pass: 'jobsearch123'
    }
  });

async function notify(job_id) {
    results = await client.sScan("mountain_view_ca", 0);
    const job = await client.json.get(job_id);
    let title = job.job_title.toLowerCase();
    for (i in results.members) {
      let subscriber = await client.json.get(results.members[i]);
      let keys = subscriber.sub_keys["mountain_view_ca"];
      console.log(keys);
      for (key of keys) {
        key.toLowerCase();
        console.log(key);
        console.log(title);
        if (title.includes(key)) {
          console.log("SENDING EMAIL");
          const mailOptions = {
            from: 'jobsearch@gmail.com',
            to: results.members[i],
            subject: 'New Job Notification',
            text: "This might be interesting for you: " + job.job_title + " in " + job.location,
          };
        
          transporter.sendMail(mailOptions, function(error, info) {
            if (error) {
              console.log(error);
            } else {
              console.log('Email sent: ' + info.response);
            }
          });

          break;
        }
      }
    }
}