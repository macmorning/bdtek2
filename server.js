//////////////////////////////////////////////////
//                                              //
//      BdTek nodejs server                     //
//  http://www.github.com/macmorning/bdtek2     //
//                                              //
//////////////////////////////////////////////////
/*
 * Copyright (c) 2016 Sylvain YVON
 * 
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:

 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE. 
 */

var PORT = process.env.PORT || 8080;
var ADDRESS = process.env.IP;
var SERVERDIR = "";

var http = require('http'),
    url = require('url'),
    fs = require('fs'),
    util = require('util'),
    Firebase = require('firebase'),
    amazon = require('amazon-product-api');
    
var configFile = SERVERDIR + 'config.json';
var myFirebaseRef;
var myAmazonClient;
var LOGFIREBA = true;
var LOGREST = true;
var LOGAMAZON = false;
var LOGSTATIC = false;

function escapeHtml(unsafe) {
    if(unsafe && isNaN(unsafe)) {// escapes Html characters
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    } else if (!isNaN(unsafe)) {
        return unsafe;
    }
    return false;
}

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
    var dataRef = snapshot.ref();
   myAmazonClient.itemLookup({
      idType: 'EAN',
      itemId: snapshot.key(),
      domain: 'webservices.amazon.fr',
      responseGroup: 'ItemAttributes,Images'
    }).then(function(results) {
      if (LOGAMAZON) { console.log(currTime() + " [LOOKUP] ... Found details for " + snapshot.key() + " : " + results[0].ItemAttributes[0].Title[0]); }
      dataRef.update({
            title: results[0].ItemAttributes[0].Title[0],
            author: results[0].ItemAttributes[0].Author,
            imageURL: results[0].LargeImage[0].URL,
            detailsURL: results[0].DetailPageURL[0],
            published: results[0].ItemAttributes[0].PublicationDate[0],
            publisher: results[0].ItemAttributes[0].Publisher[0],
            needLookup: 0
      });
    }).catch(function(err) {
      console.log(currTime() + " [LOOKUP] ... Error : " + JSON.stringify(err));
      dataRef.update({
            title: snapshot.key(),
            author: "non trouve !",
            needLookup: 0
      });
    });
}

function initFirebase(url,secret) {
    console.log(currTime() + ' [CONFIG] ... connecting to Firebase instance ' + url);
    myFirebaseRef = new Firebase(url);
    myFirebaseRef.authWithCustomToken(secret,function(error, authData) {
          if (error) {
            console.log(currTime() + " [CONFIG] ... Firebase authentication failed!", error);
          } else {
            console.log(currTime() + " [CONFIG] ... Firebase authentication succeeded, authData : " + JSON.stringify(authData));
            var bdRef = myFirebaseRef.child("bd");
            bdRef.on('child_added', function(userSnapshot) {
                var userKey = userSnapshot.key();
                if (LOGFIREBA) { console.log(currTime() + " [FIREDB] ... User ref - " + userKey); }
                var thisUserRef = bdRef.child(userKey);
                thisUserRef.on("child_changed", function (snapshot) {
                    var data = snapshot.val();
                    if (LOGFIREBA) { console.log(currTime() + " [FIREDB] ... Child changed " + snapshot.key() + " - needLookup : " + data.needLookup); }
                    if (data.needLookup) {
                        lookup(snapshot);
                    }
                });
                thisUserRef.on("child_added", function (snapshot) {
                    var data = snapshot.val();
                    if (LOGFIREBA) { console.log(currTime() + " [FIREDB] ... Child added " + snapshot.key() + " - needLookup : " + data.needLookup); }
                    if (data.needLookup) {
                        lookup(snapshot);
                    }
                });
            });
          }
    },{admin:true});
    return true;
}

function addProduct(alias,ean) {
    var userRef = myFirebaseRef.child("users");
    userRef.once('value',function(snap) {
        if(snap.val()) {
            snap.forEach(function(snapchild) {
                if(snapchild.val()['alias']===alias) {
                    console.log(snapchild.key());
                    var bdRef = myFirebaseRef.child("bd").child(snapchild.key());
                    bdRef.child(ean.trim().replace(/-/g,"")).set({
                        needLookup: 1
                    });
                }
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
            console.log(currTime() + ' [CONFIG] ... Trying env variables');
            try { 
                initAmazonClient(ENV['AWSAccessKeyId'], ENV['AWSSecretKey'], ENV['AssociateTag']);
                initFirebase(ENV['myFirebaseURL'],ENV['myFirebaseSecret']);
                return true;
           }
            catch(err) {
                console.log(currTime() + ' [CONFIG] ... ' + err);
                return false;
            }
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
    location.reload();
}


loadConfig();

//////////////////////////////////////////////////////////////////////////////////////////
//
//                              Create http server
//
//////////////////////////////////////////////////////////////////////////////////////////

http.createServer(function (req, res) {
   
//
// ROUTING
//
   var url_parts = url.parse(req.url);

    // REST services
    if(url_parts.pathname.substr(0, 5) === '/rest') {
        // expected :    /rest/<alias>/<action>/<ean>
        var request = url_parts.pathname.split("/");
        var action = escapeHtml(request[3]);
        var alias = escapeHtml(request[2]);
        var ean = escapeHtml(request[4]);
        if(LOGREST) { console.log(currTime() + ' [LOGREST ] Service called : ' + action + ' for ' + alias + ', ean : ' + ean); }
        if(action === "push") {
            if(alias && ean) {
                if(addProduct(alias, ean)) {
                    res.statusCode = 200;
                    res.end("item added");
                    return true;
                } else {
                    return resInternalError(res,"error");
                }
            } 
        }
        return resBadRequest(res,"bad request");
    }
   
    // file serving
    // thanks http://blog.phyber.com/2012/03/30/supporting-cache-controls-in-node-js/ for the cache control tips
   
    else {
        if(LOGSTATIC) { console.log(currTime() + ' [STATIC] client file request'); }
        var file='';
        if(url_parts.pathname === '/' || url_parts.pathname === '/client' || url_parts.pathname === '/client/') {
            file = 'index.html';
        }  else if(url_parts.pathname.substr(0, 8) === '/favicon') {
            // serving the favicon
            file = 'img/favicon.ico';
        }  else {
            if(url_parts.pathname.substr(0,7) === "/client") {   // remove the potential "/client" reference
                file = escapeHtml(url_parts.pathname.substr(8)); 
            } else {
                file = escapeHtml(url_parts.pathname); 
            }
        }
        if(LOGSTATIC) { console.log(currTime() + ' [STATIC] ... serving client/' + file); }
        fs.readFile(SERVERDIR+'client/'+file, function(err, data) {
            if(err) {
                console.log(currTime() + ' [STATIC] ... ' + err);
                if(err.code === "ENOENT") {      // file is simply missing
                    resNotFound(res,'file not found',err);
                } else {                        // other error; could be EACCES or anything
                    resInternalError(res,'internal server error',err);
                }
            }
            else {
                fs.stat(SERVERDIR+'client/'+file, function (err, stat) {
                    if (err) {
                        resInternalError(res,'internal server error',err);
                    }
                    else {
                        var etag = stat.size + '-' + Date.parse(stat.mtime);
                        res.setHeader('Last-Modified', stat.mtime);
                        if(LOGSTATIC) { console.log(currTime() + ' [STATIC] ... etag : ' + etag); }
                        if(LOGSTATIC) { console.log(currTime() + ' [STATIC] ... req.if-none-match : ' + req.headers['if-none-match']); }
                        if(LOGSTATIC) { console.log(req.headers); }

                        if (req.headers['if-none-match'] === etag) {
                            res.statusCode = 304;
                            res.end();
                        }
                        else {
                            res.setHeader('Content-Length', data.length);
                            res.setHeader('Cache-Control', 'public, max-age=600');
                            res.setHeader('ETag', etag);
                            res.statusCode = 200;
                            res.end(data);
                        }
                    }
                });
            }
        });
    }
}).listen(PORT,ADDRESS);
console.log(currTime() + ' [START ] Server running on port ' + PORT);   
