const redis = require('redis');
const mailer = require('nodemailer');
const { urlencoded } = require('body-parser');

let client = redis.createClient(6379, '127.0.0.1');
const subscriber = client.duplicate();
subscriber.connect();
client.connect();
var location = "";

(async () => {
  const args = process.argv.slice(2);
  location = args[0];
  const channel = "ch:" + location;
  await subscriber.subscribe(channel, (message) => {
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
    results = await client.sScan(location, 0);
    const job = await client.json.get(job_id);
    let title = job.job_title.toLowerCase();
    for (i in results.members) {
      let subscriber = await client.json.get(results.members[i]);
      let keys = subscriber.sub_keys[location];
      if (keys != null || keys != undefined) {
        for (key of keys) {
          key.toLowerCase();
          let email_body = "<h2>This might interest you: " + job.job_title + " in " + job.location + "</h2>";
          email_body = email_body + "<p>Job Type: " + job.job_type + "</p><p>Salary range: " + 
                      job.salary_range_start +  " - " + job.salary_range_end + " per " + job.salary_type +
                      "</p><p>Experience: " + job.experience + "</p><p>" + job.description + "<p>Minimum qualifications: " + job.m_qualifications +
                      "</p><p>Preferred qualifications: " + job.p_qualifications + "</p>" + "<a href='http://localhost:3000/apply/" + encodeURIComponent(results.members[i]) + "/" + job_id +"'><h3>Apply</h3></a>";
          if (title.includes(key)) {
            const mailOptions = {
              from: 'jobsearch@gmail.com',
              to: results.members[i],
              subject: 'New Job Notification',
              html: email_body
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
      } else {
        client.sRem(location, results.members[i]);
      }
    }
}