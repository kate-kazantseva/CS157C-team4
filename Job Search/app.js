const express = require('express');
const exphbs = require('express-handlebars');
const path = require('path');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const redis = require('redis');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { SchemaFieldTypes } = require('redis');

// Create Redis Client
let client = redis.createClient(6973, '127.0.0.1');
client.connect();

// Set Port
const port = 3000;

const authTokens = {};
// Init app
const app = express();

// View Engine\
// app.engine('handlebars', engine());
// app.set('view engine', 'handlebars');

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
  if (req.user.type == "student") {
    res.sendFile(__dirname + '/views/homepage-student.html');
  }
  else if(req.user.type == "recruiter"){
    res.sendFile(__dirname + '/views/homepage-recruiter.html');
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

// User settings 
app.get('/settings', function(req, res, next){
  if (req.user.type == "student") {
    res.sendFile(__dirname + '/views/usersettings-student.html');
  }
  else if(req.user.type == "recruiter"){
    res.sendFile(__dirname + '/views/usersettings-recruiter.html');
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
    res.redirect('login');
    
  } catch (err) {
    console.log(err);
  }
});

// Login API
app.post('/login', async function(req, res){
  try {
    const { email, password } = req.body;
    //validate input
    if (!(email && password)) {
      return res.status(400).send("Some fields are missing.");
    }

    client.json.get(email.toLowerCase()).then(function(user) {
      if (Object.prototype.hasOwnProperty.call(user, 'password')) {
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
            res.redirect('homepage');
          } else 
          return res.status(400).send("Incorrect password.");
        });
      } else
        return res.status(400).send("User with such email was not found.");
    });
  } catch (err) {
    console.log(err);
  }
});

// create application API
app.post('/application/create', async function(req,res,next){
  check = await client.json.get(decodeURI(req.cookies['UserEmail']));
  if (check.app_info == null) {
    client.json.set(decodeURI(req.cookies['UserEmail']), "$.app_info", req.body);
  } 

  // change job_id, need to fetch it from listing (cookie)
  var job_id;
  job_id = "job"+Math.floor(Math.random() * 1000000);

  var x = {
 };
  x[job_id] = req.body  
  if(check.submitted_apps == null){
  client.json.set(decodeURI(req.cookies['UserEmail']), "$.submitted_apps", [x])
  }else{
    client.json.arrAppend(decodeURI(req.cookies['UserEmail']), "$..submitted_apps", x)

  }


  
  res.status(201);
  res.redirect('/homepage');
});

// create job listing API
app.post('/joblisting/create', async function(req,res,next){
    var job_id;
    do {
      job_id = "job"+Math.floor(Math.random() * 1000000);
      var result = await client.json.get(job_id);
    } while (result)
    client.json.set(job_id ,"$" ,req.body);
    client.sAdd("joblist", job_id);
    res.redirect('/homepage');
});

// get job by job id
app.get('/job/:id', async function (req, res) {
  job = await client.json.get(req.params.id);
  res.setHeader('content-type', 'application/json');
  res.status(200).send(job);
});

// edit job listing API
app.post('/joblisting/edit/:id', function(req,res,next){ 
  client.hSet(req.params.id,req.body);
  res.redirect('/homepage');
  console.log('updated');
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
    job.job_id = results.members[i];
    job.saved = false;
    for (k in user.saved_jobs) {
      if (user.saved_jobs[k].job_id == job.job_id) {
        job.saved = true;
        break;
      }
    }
    job_list.push(job);
  }
  res.setHeader('content-type', 'application/json');
  res.status(200).send(job_list);
});

app.post('/save_job', async function (req, res) {
  check = await client.json.get(decodeURI(req.cookies['UserEmail']));
  if (check.saved_jobs == null) {
    client.json.set(decodeURI(req.cookies['UserEmail']), "$.saved_jobs", [req.body]);
  } else client.json.arrAppend(decodeURI(req.cookies['UserEmail']), "$..saved_jobs", req.body);
  res.status(201);
  res.send();
});

app.delete('/save_job', async function (req, res) {
  user = await client.json.get(decodeURI(req.cookies['UserEmail']));
  for (i in user.saved_jobs) {
    if (user.saved_jobs[i].job_id == req.body.job_id) {
      client.json.arrPop(decodeURI(req.cookies['UserEmail']), "$.saved_jobs", i);
      res.status(200).send();
    }
  }
  res.status(400).send();
});

app.get('/saved_jobs', async function (req, res) {
  user = await client.json.get(decodeURI(req.cookies['UserEmail']));
  res.setHeader('content-type', 'application/json');
  res.status(200).send(user.saved_jobs);
});

// edit job listing API
app.post('/joblisting/edit/:id', function(req,res,next){ 
  client.hSet(req.params.id,req.body);
  res.redirect('/homepage');
  console.log('updated');
});
// get joblistings based on criteria
app.get('/joblistings/search/:title', async function (req, res) {
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
  const query = "@job_title:"+req.params.title+"*"
  result = await client.ft.search(index_name, query);
  console.log(result)
  res.setHeader('content-type', 'application/json');
  res.status(200).send(result);
});

app.get('/submitted_apps', async function (req, res) {
  user = await client.json.get(decodeURI(req.cookies['UserEmail']));
  res.setHeader('content-type', 'application/json');
  res.status(200).send(user.submitted_apps);
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

app.listen(port, function(){
    console.log('Server started on port ' + port);
  });

client.on('connect', function(){
    console.log('Connected to Redis...');
  }).on('error', function (error) {
    console.log(error);
  });