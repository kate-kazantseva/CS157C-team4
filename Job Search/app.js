const express = require('express');
const exphbs = require('express-handlebars');
const path = require('path');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const redis = require('redis');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

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
    res.sendFile(__dirname + '/views/homepage.html');
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
    client.hGetAll(email.toLowerCase(), function(result) {
      if (result) {
        return res.status(409).send("User with this email already has an account.");
      }
    });

    //encrypt password
    encr_pword = await bcrypt.hash(password, 10);
    
    client.hSet(email.toLowerCase(), 'password', encr_pword);

    user = {
      'first_name': first_name,
      'last_name': last_name,
      'email': email.toLowerCase(),
      'password': encr_pword,
      'school':school,
      'type': type,
    };

    const token = jwt.sign(
      { user_id: email },
      'secret',
      {
        expiresIn: "2h",
      }
    );
    user.token = token;

    res.status(201).json(user);

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
    client.hGetAll(email.toLowerCase()).then(function(user) {
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
            res.cookie('AuthToken', token);
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

app.get('/logout', function (req, res){
    authTokens[req.cookies['AuthToken']] = null;
    res.redirect('login');
});

app.listen(port, function(){
    console.log('Server started on port '+port);
  });

client.on('connect', function(){
    console.log('Connected to Redis...');
  }).on('error', function (error) {
    console.log(error);
  });