const express = require('express');
const { engine } = require('express-handlebars');
const path = require('path');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const redis = require('redis');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { SchemaFieldTypes } = require('redis');
const { application } = require('express');
const { time } = require('console');

// Create Redis Client
let client = redis.createClient(6973, '127.0.0.1');
client.connect();

// Set Port
const port = 3000;

const authTokens = {};
// Init app
const app = express();

// body-parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:false}));
app.use(cookieParser());

// methodOverride
app.use(methodOverride('_method'));
app.use((req, res, next) => {
  const token = req.cookies['AuthToken'];
  req.user = authTokens[token];
  next();
});

app.engine('handlebars', engine({layoutsDir: __dirname + '/views/layouts'}));
app.set('view engine', 'handlebars');

// Load css
app.use(express.static('public'));

//Login page
app.get('/login', function(req, res, next){
  if (req.user) {
    res.redirect('homepage');
  } else
    res.sendFile(__dirname + '/views/login.html');
});

//Register page
app.get('/', function(req, res, next){
  if (req.user) {
    res.redirect('homepage');
  } else
    res.sendFile(__dirname + '/views/register.html');
});


app.get("/homepage", function (req, res) {
  if (req.user) {
    if (req.user.type == "student") {
      res.sendFile(__dirname + '/views/homepage-student.html');
    }
    else if(req.user.type == "recruiter"){
      res.sendFile(__dirname + '/views/homepage-recruiter.html');
    } 
  } else {
    res.redirect('login');
  }
});

// Recruiter jobs
app.get('/recruiter/jobs', async function (req, res) {
  if (req.user) {
    res.sendFile(__dirname + '/views/jobs-recruiter.html');
  } else {
    res.redirect('login');
  }
});

// Create job listing Page
app.get('/joblisting/create', function(req, res, next){
  if (req.user) {
    res.sendFile(__dirname + '/views/createjoblisting.html');
  } else {
    res.redirect('login');
  }
});

// Edit job listing Page
app.get('/joblisting/edit', function(req, res, next){
  if (req.user) {
    res.sendFile(__dirname + '/views/editjoblisting.html');
  } else {
    res.redirect('login');
  }
});

// Saved jobs listing Page
app.get('/savedjobs', function(req, res, next){
  if (req.user) {
    res.sendFile(__dirname + '/views/savedjobs.html');
  } else {
    res.redirect('login');
  }
});

// Recently applied job listings Page
app.get('/recently_applied', function(req, res, next){
  if (req.user) {
    res.sendFile(__dirname + '/views/recently_applied.html');
  } else {
    res.redirect('login');
  }
});

// Recruiter applications
app.get('/recruiter/applications', async function (req, res) {
  if (req.user) {
    res.sendFile(__dirname + '/views/applications-recruiter.html');
  } else {
    res.redirect('login');
  }
});

// Job Search Page
app.get('/job_search', function(req, res, next){
  //Outputs all jobs for now, no search
  if (req.user) {
    res.sendFile(__dirname + '/views/job_search_page.html');
  } else {
    res.redirect('login');
  }
});

// Job Search Page
app.get('/my_joblistings', function(req, res, next){
  //Outputs all jobs for now, no search
  if (req.user) {
    res.sendFile(__dirname + '/views/my-jobs.html');
  } else {
    res.redirect('login');
  }
});

// User settings 
app.get('/settings', function(req, res, next){
  if (req.user) {
    if (req.user.type == "student") {
      res.sendFile(__dirname + '/views/usersettings-student.html');
    }
    else if(req.user.type == "recruiter"){
      res.sendFile(__dirname + '/views/usersettings-recruiter.html');
    }
  }
  else {
    res.redirect('login');
  }
});

// Submit application page
app.get('/application/create', function(req, res, next){
  if (req.user) {
    res.sendFile(__dirname + '/views/application-page.html');
  } else {
    res.redirect('login');
  }
});

// view job description page
app.get('/jobdescription', function(req, res, next){
  if (req.user) {
    res.sendFile(__dirname + '/views/job-description-page.html');
  } else {
    res.redirect('login');
  }
});

// view job description page
app.get('/submitted-application', function(req, res, next){
  if (req.user) {
    res.sendFile(__dirname + '/views/submitted-application.html');
  } else {
    res.redirect('login');
  }
});

app.get('/my_subscriptions', function (req, res) {
  if (req.user) {
    if (req.user.type === "student") {
      res.sendFile(__dirname + '/views/subscriptions.html');
    }
  } else res.redirect('login');
}); 

//Sign up API
app.post('/register', async function(req, res, next) {
  try {
    const {first_name, last_name, email, password, type, school} = req.body;
    //validate input
    if (!(email && password && first_name && last_name && type && school)) {
      return res.status(400).send("Some fields are missing.");
    }
    //check for existing user
    result = await client.json.get(email.toLowerCase())
    if (result) {
      return res.status(409).send("User with this email already has an account.");
    }

    //encrypt password
    encr_pword = await bcrypt.hash(password, 10);
    
    user = {
      'first_name': first_name,
      'last_name': last_name,
      'email': email.toLowerCase(),
      'password': encr_pword,
      'school':school,
      'type': type,
    };

    client.json.set(email.toLowerCase(), '$', user);
    res.status(201).send();
    
  } catch (err) {
    console.log(err);
  }
});

// Login API
app.post('/login', async function(req, res){
  try {
    const { email, password } = req.body;
    //validate input`
    if (!(email && password)) {
      return res.status(400).send("Some fields are missing.");
    }
    let user = await client.json.get(email.toLowerCase());
    if (user === undefined || user === null) {
      res.status(400).send("User with such email was not found.");
    } else {
      bcrypt.compare(password, user.password).then(function(correct) {
        if (correct) {
          const token = jwt.sign(
            {user_id: email},
            'secret',
            {
              expiresIn: "2h",
            }
          );
          user.email = email;
          authTokens[token] = user;
          res.cookie('AuthToken', token)
          res.cookie('UserFirstName', user.first_name);
          res.cookie('UserLastName', user.last_name);
          res.cookie('UserEmail', user.email);
          res.cookie('UserOrg/School', user.school);
          res.status(200).send();
        } else 
        return res.status(400).send("Incorrect password.");
      });
    }
  } catch (err) {
    console.log(err);
  }
});

// user-settings
app.post('/settings', async function(req, res){
  console.log('changing password')
  try {
    const { old_password, new_password } = req.body;
    //validate input
    if (!(old_password && new_password)) {
      return res.status(400).send("Some fields are missing.");
    }
    data = await client.json.get(decodeURI(req.cookies['UserEmail']));

    client.json.get(data.email.toLowerCase()).then(function(user) {
      if (Object.prototype.hasOwnProperty.call(user, 'password')) {

        // validate old and new password
        bcrypt.compare(new_password, user.password).then(async function(check){
          if(check){
          return res.status(400).send("Old and new password are same");
          }
        else{
          // validate old password with stored password
        bcrypt.compare(old_password, user.password).then(async function(correct) {
          if (correct) {
            encr_pword = await bcrypt.hash(new_password, 10);
            client.json.set(decodeURI(req.cookies['UserEmail']), "$.password", encr_pword);
            res.redirect('homepage');
          } else 
          return res.status(400).send("Incorrect old password.");
        });
      }
      })
      } else
        return res.status(400).send("User doesn't exist");
    });
  } catch (err) {
    console.log(err);
  }
});

// create application API
app.post('/application/create/:id', async function(req,res,next){
  check = await client.json.get(decodeURI(req.cookies['UserEmail']));
  if (check.app_info == null) {
    client.json.set(decodeURI(req.cookies['UserEmail']), "$.app_info", req.body);
  } 
  var app_id = req.params.id + ":" + decodeURI(req.cookies['UserEmail']);
  var result = await client.json.get(app_id);
  if (result != null) {
    res.status(409).send();
  }
  let application = req.body;
  application.status = "pending";
  client.json.set(app_id, "$", application);
  //add to application id to job listing for easy retrieval of all 
  //applications for recruiter
  var listing = await client.json.get(req.params.id);
  if (listing.applications == null) {
    client.json.set(req.params.id, "$.applications", [app_id])
  } else {
    client.json.arrAppend(req.params.id, "$..applications", app_id)
  }

  var saved_app_info = {"job_id": req.params.id, "job_title": listing.job_title,
                        "location": listing.location, "company_name": listing.company_name,
                        "app_id": app_id};

  if(check.submitted_apps == null){
    client.json.set(decodeURI(req.cookies['UserEmail']), "$.submitted_apps",
                    [saved_app_info])
  }else{
    client.json.arrAppend(decodeURI(req.cookies['UserEmail']), "$..submitted_apps", saved_app_info)
  }
  if (listing.created_by != undefined) {
    client.zAdd(listing.created_by + ":inbox", {score: -Date.now(), value: req.params.id});
  }
  let new_app_count = listing.new_app_count;
  if (new_app_count != undefined) {
    client.json.set(req.params.id, "$.new_app_count", Number(new_app_count)+1);
  }
  res.redirect('/homepage');
});

// create job listing API
app.post('/joblisting/create', async function(req,res,next){
  if (req.user) {
    if (req.user.type != 'recruiter') res.status(401).send();
  } else res.status(401).send();
  let job_id;
  do {
    job_id = "job"+Math.floor(Math.random() * 1000000);
    var result = await client.json.get(job_id);
  } while (result)
  let job_info = req.body;
  job_info.created_by = req.user.email;
  job_info.new_app_count = 0;
  client.json.set(job_id ,"$" , job_info);
  client.sAdd("joblist", job_id);
  check = await client.json.get(decodeURI(req.cookies['UserEmail']));
  if (check.created_jobs == null) {
    client.json.set(decodeURI(req.cookies['UserEmail']), "$.created_jobs", [job_id]);
  } else client.json.arrAppend(decodeURI(req.cookies['UserEmail']), "$..created_jobs", job_id);
  const loc = req.body.location.split(",");
  loc[0] = loc[0].toLowerCase().replace(" ", "_");
  var channelName = "ch:" + loc[0];
  if (loc[1] != undefined && loc[1] != null) {
    loc[1] = loc[1].toLowerCase().replace(" ", "");
    channelName = "ch:" + loc[0] + "_" + loc[1];
  }
  client.publish(channelName, job_id);
  client.zAdd(req.user.email + ":inbox", {score: -Date.now(), value: job_id});
  res.redirect('/homepage');
});

app.get('/inbox', async function (req, res) {
  if (req.user) {
    if (req.user.type === "recruiter") {
      let set = await client.zRangeByScore(req.user.email + ":inbox", "-inf",
                                           "+inf", {"LIMIT": {offset: "0", count: "4"}});
      let list = [];
      for (element of set) {
        let result = await client.json.get(element);
        if (result != undefined || result != null)
          list.push(result);
      }
      res.status(200).send(list);
    } else res.status(401).send();
  } else res.status(401).send();
});

app.get('/inbox/applications', async function (req, res) {
  if (req.user) {
    if (req.user.type === "recruiter") {
      let set = await client.zRangeByScore(req.user.email + ":inbox", "-inf", "+inf");
      let list = [];
      if (set != undefined) {
        for (element of set) {
          let job = await client.json.get(element);
          if (job != undefined && job != null) {
            job.job_id = element;
            let app_info_list = [];
            if (job.applications != undefined) {
              for (app_id of job.applications) {
                let app_info = await client.json.get(app_id);
                app_info.app_id = app_id;
                app_info_list.push(app_info);
              }
            }
            job.app_info_list = app_info_list;
          }

          list.push(job);
        }
      }
      res.status(200).send(list);
    } else res.status(401).send();
  } else res.status(401).send();
});

app.post('/status/:app_id', async function (req, res) {
  console.log(req.params.app_id);
  console.log(req.body.status);
  if (req.user) {
    if (req.body.status != "select status") {
      client.json.set(decodeURI(req.params.app_id), "$.status", req.body.status);
    }
    res.status(201).send();
  } else res.status(401).send();
});

app.get('/inbox/reset/:job_id', async function (req, res) {
  client.json.set(req.params.job_id, "$.new_app_count", 0);
});

// get job by job id
app.get('/job/:id', async function (req, res) {
  job = await client.json.get(req.params.id);
  res.setHeader('content-type', 'application/json');
  res.status(200).send(job);
});

app.get('/logout', function (req, res){
  authTokens[req.cookies['AuthToken']] = null;
  res.redirect('login');
});

app.get('/jobs', async function (req, res) {
  //TODO: check if applied
  results = await client.sScan("joblist", 0, {"MATCH": "job*"});
  job_list = [];
  user = await client.json.get(decodeURI(req.cookies['UserEmail']));
  for (i in results.members) {
    job = await client.json.get(results.members[i]);
    if (job != null || job != undefined) {
      job.job_id = results.members[i];
      job.saved = false;
      job.applied = false;
      for (k in user.saved_jobs) {
        if (user.saved_jobs[k] == job.job_id) {
          job.saved = true;
          break;
        }
      }
      for (k in user.submitted_apps) {
        if (user.submitted_apps[k].job_id == job.job_id) {
          job.applied = true;
          break;
        }
      }
      job_list.push(job);
    }
  }
  res.setHeader('content-type', 'application/json');
  res.status(200).send(job_list);
});

app.post('/save_job', async function (req, res) {
  check = await client.json.get(decodeURI(req.cookies['UserEmail']));
  if (check.saved_jobs == null) {
    client.json.set(decodeURI(req.cookies['UserEmail']), "$.saved_jobs", [req.body.job_id]);
  } else client.json.arrAppend(decodeURI(req.cookies['UserEmail']), "$..saved_jobs", req.body.job_id);
  res.status(201);
  res.send();
});

app.delete('/save_job', async function (req, res) {
  user = await client.json.get(decodeURI(req.cookies['UserEmail']));
  for (i in user.saved_jobs) {
    if (user.saved_jobs[i] == req.body.job_id) {
      client.json.arrPop(decodeURI(req.cookies['UserEmail']), "$.saved_jobs", i);
      res.status(200).send();
    }
  }
  res.status(400).send();
});

//delete job 
app.delete('/delete_job', async function (req, res) {
  console.log('in delete api');
  console.log('job id id'+req.body.job_id);
  user = await client.json.get(decodeURI(req.cookies['UserEmail']));
  await client.json.del(req.body.job_id);
  for (i in user.created_jobs) {
    if (user.created_jobs[i] == req.body.job_id) {
      client.json.arrPop(decodeURI(req.cookies['UserEmail']), "$.created_jobs", i);
      res.status(200).send();
    }
  }
  res.status(400).send();
});

app.get('/saved_jobs', async function (req, res) {
  user = await client.json.get(decodeURI(req.cookies['UserEmail']));
  res.setHeader('content-type', 'application/json');
  if(user.saved_jobs === null){
    res.status(200).send([]);
  }else{
    const list = [];
    if (user.saved_jobs != undefined) {
      for (job of user.saved_jobs) {
        const saved_job = await client.json.get(job);
        if (saved_job != null || saved_job != undefined) {
          saved_job.job_id = job;
          if (saved_job != null)
          if(user.submitted_apps !=undefined){
            for (job_app of user.submitted_apps) {
              if (job_app.job_id == job) {
                saved_job.applied = true;
              } else saved_job.applied = false;
            }
          }
            list.push(saved_job);
        }
      }
    }
    res.status(200).send(list);
  }
});

app.post('/apply/:id', async function (req, res) {
  if (decodeURI(req.cookies['UserEmail'])) {
    res.render('main', {layout : 'application', job_title: req.body.job_title,
                                                job_id: req.params.id});
  } else {
    res.redirect('login');
  }
});

app.get('/apply/:id', async function (req, res) {
  if (decodeURI(req.cookies['UserEmail'])) {
    res.render('main', {layout : 'application', job_title: req.body.job_title,
                                                job_id: req.params.id});
  } else {
    res.redirect('login');
  }
});

// edit auto-fill
app.post('/edit/:id', async function (req, res) {
  if (req.user) {
    job_info = await client.json.get(req.params.id)
    res.render('main', {layout : 'edit', job_title: req.body.job_title,
                                          info:job_info,
                                                job_id: req.params.id});
  } else {
    res.redirect('login');
  }
});

// save the edited job listing on the backend
app.post('/editted/:id', async function (req, res) {
  let old_info = await client.json.get(req.params.id);
  let new_info = req.body;
  new_info["new_app_count"] = old_info.new_app_count;
  new_info["applications"] = old_info.applications;
  new_info["created_by"] = old_info.created_by;
  client.json.set(req.params.id ,"$" ,req.body);
  res.redirect('/homepage');
});

// get joblistings based on criteria
app.post('/joblistings/search/', async function (req, res) {
  var exists = new Boolean(false);
  var index_name = "new_index"
  //check if index already exists
  try{
  const check = await client.ft.info(index_name)
  }catch (err) {
    console.log(err);
    exists = true
  }

  // create serach index
  if(exists === true){
  await client.ft.create(index_name, {
    '$.job_title': {
      type: SchemaFieldTypes.TEXT,
      AS: 'job_title'
    },
    '$.job_type': {
      type: SchemaFieldTypes.TEXT,
      AS: 'job_type'
    },
    '$.location': {
      type: SchemaFieldTypes.TEXT,
      AS: 'location'
    }
  }, {
    ON: 'JSON',
    PREFIX: 'job'
  });
}


  // query jobs based on title
  var query =''

  // only title
  if(req.body.search !== '' & req.body.location === '' & req.body.type === 'none'){
    query = query+"@job_title:"+req.body.search+"*"
  }

  // only location
  if(req.body.search === '' & req.body.location !== '' & req.body.type === 'none'){
    query = query+"@location:"+req.body.location+"*"
  }

  //only job type
  if(req.body.search === '' & req.body.location === '' & req.body.type !== 'none'){
    query = query+"@job_type:"+req.body.type+"*"
  }

  //title, location and type
  if(req.body.search !== '' & req.body.location !== '' & req.body.type !== 'none'){
    query = query+"@job_title:"+req.body.search+"*"
    query = query+",@location:"+req.body.location+"*"
    query = query+",@job_type:"+req.body.type+"*"
  }

  //location and type
  if(req.body.search === '' & req.body.location !== '' & req.body.type !== 'none'){
    query = query+"@location:"+req.body.location+"*"
    query = query+",@job_type:"+req.body.type+"*"
  }

  // title and location
  if(req.body.search !== '' & req.body.location !== '' & req.body.type === 'none'){
    query = query+"@job_title:"+req.body.search+"*"
    query = query+",@location:"+req.body.location+"*"
  }

  // title and type
  if(req.body.search !== '' & req.body.location === '' & req.body.type !== 'none'){
    query = query+"@job_title:"+req.body.search+"*"
    query = query+",@job_type:"+req.body.type+"*"
  }
  result = await client.ft.search(index_name, query);
  job_list = [];
  let user = await client.json.get(req.user.email);
  res.setHeader('content-type', 'application/json');
  result.documents.forEach((job) => {
    let job_info = job.value;
    job_info.saved = false;
    job_info.applied = false;
    job_info.job_id = job.id;
    for (k in user.saved_jobs) {
      if (user.saved_jobs[k] == job.id) {
        job_info.saved = true;
        break;
      }
    }
    for (k in user.submitted_apps) {
      if (user.submitted_apps[k].job_id == job.id) {
        job_info.applied = true;
        break;
      }
    }
    job_list.push(job_info);
  });
  res.status(200).send(job_list);
});

app.get('/submitted_apps', async function (req, res) {
  user = await client.json.get(decodeURI(req.cookies['UserEmail']));
  res.setHeader('content-type', 'application/json');
  if(user.submitted_apps === undefined){
    res.status(200).send([{'msg':'no'}]);
  }
  else{
    let list = [];
    for (submitted_app of user.submitted_apps) {
      let result = await client.json.get(submitted_app.app_id);
      let app_info = submitted_app;
      app_info.status = result.status;
      list.push(app_info);
    }
    res.status(200).send(list);
  }
});

app.get('/created_jobs', async function (req, res) {
  user = await client.json.get(decodeURI(req.cookies['UserEmail']));
  res.setHeader('content-type', 'application/json');
  if(user.created_jobs === undefined){
    res.status(200).send([]);
  }else{
    var job_info=[];
    for(i in user.created_jobs){
      var info = await client.json.get(user.created_jobs[i])
      if (info != null || info != undefined) {
        info.job_id = user.created_jobs[i]
        job_info.push(info)
      }
    }
    res.status(200).send(job_info);
  }
});

app.get('/most_recent_listings', async function (req, res) {
  if (req.user) {
    if (req.user.type === "recruiter") {
      user = await client.json.get(req.user.email);
      res.setHeader('content-type', 'application/json');
      if(user.created_jobs === undefined){
        res.status(200).send([]);
      } else {
        var job_info=[];
        for(i = user.created_jobs.length - 1; i >= 0; i--){
          if (job_info.length == 4)
            break;
          var info = await client.json.get(user.created_jobs[i])
          if (info != undefined || info != null) {
            info.job_id = user.created_jobs[i]
            job_info.push(info)
          }
        }
        res.status(200).send(job_info);
      }
    } else res.status(401).send();
  } else res.status(401).send();
});


app.get('/app_info', async function (req, res) {
  user = await client.json.get(decodeURI(req.cookies['UserEmail']));
  res.setHeader('content-type', 'application/json');
  res.status(200).send(user.app_info);
});

app.get('/user', async function (req, res) {
  user = await client.json.get(decodeURI(req.cookies['UserEmail']));
  res.setHeader('content-type', 'application/json');
  res.status(200).send(user);
});

app.post('/subscribe', async function(req, res) {
  if (req.user) {
    const channel = decodeURI(req.body.loc).split(',');
    channel[0] = channel[0].toLowerCase().replace(" ","_");
    var channelName = channel[0];
    if (channel[1] != undefined && channel[1] != null) {
      channel[1] = channel[1].toLocaleLowerCase().replace(" ", "");
      channelName = channel[0] + "_" + channel[1];
    }
    const user = await client.json.get(req.user.email);
    if (user.sub_keys == undefined) {
      const obj = {};
      obj[channelName] = [req.body.key];
      client.json.set(req.user.email, "$.sub_keys", obj);
    } else {
      if (user.sub_keys[channelName] != undefined) {
        client.json.arrAppend(req.user.email, "$.sub_keys." + channelName, req.body.key)
      } else
        client.json.set(req.user.email, "$.sub_keys." + channelName, [req.body.key]);
    }
    client.sAdd(channelName, req.user.email);
    let response = {};
    response["channel"] = channelName;
    res.setHeader('Content-Type', 'application/json');
    res.status(201).send(response);
  } else {
    res.status(401).send();
  }
});

app.delete('/unsubscribe', async function (req, res) {
  if (req.user) {
    let user = await client.json.get(req.user.email);
    let keys = user.sub_keys;
    if (keys[req.body.channel].length == 1) {
      client.json.del(req.user.email, "$.sub_keys." + req.body.channel);
      client.sRem(req.body.channel, req.body.key);
    } else {
      let idx = keys[req.body.channel].indexOf(req.body.key);
      if (idx != -1)
        client.json.arrPop(req.user.email, "$.sub_keys." + req.body.channel, idx);
    }
    res.status(200).send();
  } else {
    res.status(401).send();
  }
});


app.get('/subscriptions', async function (req, res) {
  if (req.user) {
    if (req.user.type === "student") {
      const user = await client.json.get(req.user.email);
      res.status(200).send(user.sub_keys);
    } else res.status(401).send();
  } else res.status(401).send();
})


app.listen(port, function(){
    console.log('Server started on port ' + port);
  });

client.on('connect', function(){
    console.log('Connected to Redis...');
  }).on('error', function (error) {
    console.log(error);
  });
