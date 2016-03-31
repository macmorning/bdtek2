var PORT = process.env.PORT || 8080;
var ADDRESS = process.env.IP;
var SERVERDIR = "";

var express = require('express'),
    path = require('path'),
    fs = require('fs'),
    Firebase = require('firebase'),
    bodyParser = require('body-parser');
var configFile = SERVERDIR + 'config.json';
var myFirebaseRef;

var AWSAccessKeyId = "";
var AWSSecretKey = "";
var AssociateTag = "";

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


function loadConfig() {
    fs.readFile(configFile, function(err, data) {
        if(err) {
            console.log(currTime() + ' [CONFIG] ... ' + err);
            return false;
        } else {
            var latestAnnouncement = '';
            try { 
                var json = JSON.parse(data); 
            }
            catch(err) {
                console.log(currTime() + ' [CONFIG] ... ' + err);
                return false;
            }
            AWSAccessKeyId = json.AWSAccessKeyId;
            AWSSecretKey = json.AWSSecretKey;
            AssociateTag = json.AssociateTag;
            initFirebase(json.myFirebaseURL,json.myFirebaseSecret);
            return true;
        }                
    });
}

function initFirebase(url,secret) {
    console.log(currTime() + ' [CONFIG] ... connecting to Firebase instance ' + url);
    myFirebaseRef = new Firebase(url);
     myFirebaseRef.authWithCustomToken(secret,function(error, authData) {
          if (error) {
            console.log(currTime() + " [CONFIG] ... authentication failed!", error);
          } else {
            console.log(currTime() + " [CONFIG] ... authenticated successfully");
          }
    });
    return true;
}


function logout() {
    myUserID = "";
    myUserName = "";
    myFirebaseRef.unauth();
    location.reload();
}


loadConfig();
//create the app instance
var app = express();
//serve static files
app.use(express.static(path.join(__dirname, 'public')));
//parse POST data
app.use(bodyParser.urlencoded({ extended: false }))
/*
app.get('/data', function(req, res){
    res.send([{ name:"Test 1" }, { name:"Test 2" }]);
});
*/
app.listen(PORT);
