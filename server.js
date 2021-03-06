// Load required modules
var http    = require("http");              // http server core module
var https = require('https');
var express = require("express");           // web framework external module
var serveStatic = require('serve-static');  // serve static files
var socketIo = require("socket.io");        // web socket external module
var easyrtc = require('./lib/easyrtc_server');              // EasyRTC external module
var cors = require('cors');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var path = require('path');
const route = require('./api/routes/todoRoutes');

// Connect to MongoDB
// mongoose.connect('mongodb://localhost:27017/contactlist');

// mongoose.connection.on('connected', () => {
//     console.log('Connected to MongoDB');    
// })

// mongoose.connection.on('error', (err) => {
//     if(err){
//         console.log('Error in MongoDB ' + err);   
//     } 
// })

// Set process name
process.title = "node-easyrtc";

// Global Variables
var callwaiting = false;

// Setup and configure Express http server. Expect a subfolder called "static" to be the web root.
var app = express();
app.use(cors())
app.use(bodyParser.urlencoded({extended: true}))
app.use(bodyParser.json());

//  Use routes defined in Route.js and prefix it with api
app.use('/api', route);

app.use(express.static(path.join(__dirname, '/public')));

app.post('/robotData', (request, response) => {
   console.log(request.body);
   response.json({"callwaiting": callwaiting});
});

// app.get('*', (req, res, next) => {
//     res.sendfile(__dirname + '/public/index.html')
// })

var port = process.env.PORT || 8080;
// Start Express http server on port 8080
var webServer = http.createServer(app);

// Start Socket.io so it attaches itself to Express server
var socketServer = socketIo.listen(webServer, {"log level":1});

easyrtc.setOption("logLevel", "debug");

// Overriding the default easyrtcAuth listener, only so we can directly access its callback
easyrtc.events.on("easyrtcAuth", function(socket, easyrtcid, msg, socketCallback, callback) {
    easyrtc.events.defaultListeners.easyrtcAuth(socket, easyrtcid, msg, socketCallback, function(err, connectionObj){
        if (err || !msg.msgData || !msg.msgData.credential || !connectionObj) {
            callback(err, connectionObj);
            return;
        }

        connectionObj.setField("credential", msg.msgData.credential, {"isShared":false});

        console.log("["+easyrtcid+"] Credential saved!", connectionObj.getFieldValueSync("credential"));

        callback(err, connectionObj);
    });
});

//Overriding onDisconnect
easyrtc.events.on("disconnect", function (connectionObj, callback) {
  callwaiting = false;
  easyrtc.events.defaultListeners.disconnect(connectionObj, callback);
})

// To test, lets print the credential to the console for every room join!
easyrtc.events.on("roomJoin", function(connectionObj, roomName, roomParameter, callback) {
    connectionObj.generateRoomList(function (error, data) {
      console.log("------------- " + data[roomName].numberClients + " -------------");
      if(data[roomName].numberClients < 2){
        console.log("["+connectionObj.getEasyrtcid()+"] Credential retrieved!", connectionObj.getFieldValueSync("credential"));
        callwaiting = true;
        easyrtc.events.defaultListeners.roomJoin(connectionObj, roomName, roomParameter, callback);
      }
    })    
});

// Start EasyRTC server
var rtc = easyrtc.listen(app, socketServer, null, function(err, rtcRef) {
    console.log("Initiated");

    rtcRef.events.on("roomCreate", function(appObj, creatorConnectionObj, roomName, roomOptions, callback) {
        console.log("roomCreate fired! Trying to create: " + roomName);

        appObj.events.defaultListeners.roomCreate(appObj, creatorConnectionObj, roomName, roomOptions, callback);
    });
});

//listen on port 8080
webServer.listen(port, function () {
    console.log('Server started at PORT:'+ port);
});
