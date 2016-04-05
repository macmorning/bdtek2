var PORT = process.env.PORT || 8080;
var ADDRESS = process.env.IP;
var SERVERDIR = "";

var express = require('express'),
    path = require('path'),
    fs = require('fs'),
    Firebase = require('firebase'),
    bodyParser = require('body-parser'),
    amazon = require('amazon-product-api');
var configFile = SERVERDIR + 'config.json';
var myFirebaseRef;
var myAmazonClient;

function currTime() {
    // write current time in HH:mm format
    var currentDate = new Date();
    var hours = currentDate.getHours();
    if (hours < 10) { hours = "0" + hours; }
    var minutes = currentDate.getMinutes();
    if (minutes < 10) { minutes = "0" + minutes; }
    return(hours + ":" + minutes);
}

function resBadRequest(res,err,data) {
    res.writeHead(400, { 'Content-type': 'text/txt'});
    res.end('Bad request');
    console.log(currTime() + ' [BADREQ] ... error : ' + err);
    console.log(data);
    return true;
}
function resNotFound(res,err,data) {
    res.writeHead(404, { 'Content-type': 'text/txt'});
    res.end('Not found');
    console.log(currTime() + ' [NOTFOU] ... error : ' + err);
    console.log(data);
    return true;
}
function resInternalError(res,err,data) {
    res.writeHead(500, { 'Content-type': 'text/txt'});
    res.end('Internal server error');
    console.log(currTime() + ' [INTERN] ... error : ' + err);
    console.log(data);
    return true;
}
function resUnauthorized(res,err,data) {
    res.writeHead(401, { 'Content-type': 'text/txt'});
    res.end('Unauthorized');
    console.log(currTime() + ' [UNAUTH] ... error : ' + err);
    console.log(data);
    return true;
}

function lookup(snapshot) {
   myAmazonClient.itemLookup({
      idType: 'EAN',
      itemId: snapshot.key(),
      domain: 'webservices.amazon.fr',
      responseGroup: 'ItemAttributes,Images'
    }).then(function(results) {
      var data = snapshot.val();
      console.log(results[0].ItemAttributes[0].Title);
      console.log(results[0].ItemAttributes[0].EAN);
      console.log(results[0].MediumImage[0].URL);
      console.log(results[0].ASIN);

      data.title = results[0].ItemAttributes[0].Title;
      data.author = results[0].ItemAttributes[0].Author;
      data.needLookup = 0;
    }).catch(function(err) {
      console.log(err);
    });
}

function initFirebase(url,secret) {
    console.log(currTime() + ' [CONFIG] ... connecting to Firebase instance ' + url);
    myFirebaseRef = new Firebase(url);
     myFirebaseRef.authWithCustomToken(secret,function(error, authData) {
          if (error) {
            console.log(currTime() + " [CONFIG] ... Firebase authentication failed!", error);
          } else {
            console.log(currTime() + " [CONFIG] ... Firebase authentication succeeded");
            myFirebaseRef.on('child_added', function(userSnapshot) {
                var userKey = userSnapshot.key();
                console.log(currTime() + " [FIREDB] ... User ref - " + userKey);
                var thisUserRef = new Firebase(url + "/" + userKey, secret);
                thisUserRef.on("child_added", function (snapshot) {
                    var data = snapshot.val();
                    console.log("bd : " + snapshot.key() + " / needLookup : " + data.needLookup);
                    if (data.needLookup) {
                        lookup(snapshot);
                    }
                });
            });
          }
    });
    return true;
}


function initAmazonClient(keyid,secret,tag) {
    console.log(currTime() + ' [CONFIG] ... Amazon client initializing with key - ' + keyid);
    myAmazonClient = amazon.createClient({
      awsId: keyid,
      awsSecret: secret,
      awsTag: tag
    });
    console.log(currTime() + ' [CONFIG] ... Amazon client initialized');


    // test 'Les Insectes : Pour les faire connaitre aux enfants'
    /*
    myAmazonClient.itemLookup({
      idType: 'EAN',
      itemId: '9782215080640',
      domain: 'webservices.amazon.fr',
      responseGroup: 'ItemAttributes,Images'
    }).then(function(results) {
      console.log(results[0].ItemAttributes[0].Title);
      console.log(results[0].ItemAttributes[0].EAN);
      console.log(results[0].MediumImage[0].URL);
      console.log(results[0].ASIN);
    }).catch(function(err) {
      console.log(err);
    });
    */
    
    return true;
}

function loadConfig() {
    fs.readFile(configFile, function(err, data) {
        if(err) {
            console.log(currTime() + ' [CONFIG] ... ' + err);
            return false;
        } else {
            try { 
                var json = JSON.parse(data); 
                initAmazonClient(json.AWSAccessKeyId, json.AWSSecretKey, json.AssociateTag);
                initFirebase(json.myFirebaseURL,json.myFirebaseSecret);
                return true;
            }
            catch(err) {
                console.log(currTime() + ' [CONFIG] ... ' + err);
                return false;
            }
        }                
    });
}



function logout() {
    myFirebaseRef.unauth();
    location.reload();
}


loadConfig();
//create the app instance
var app = express();
//serve static files
app.use(express.static(path.join(__dirname, 'client')));
//parse POST data
app.use(bodyParser.urlencoded({ extended: false }));
/*
app.get('/data', function(req, res){
    res.send([{ name:"Test 1" }, { name:"Test 2" }]);
});
*/
app.listen(PORT);
