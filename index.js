const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000

const fs = require('fs')

var originalFoo = fs.readFileSync('./public/js/utils.js', 'utf8');
fs.writeFileSync('./utils.js', originalFoo + "\nmodule.exports = exports;");
const utils = require('./utils');

// -- EXPRESS SETUP --
const app = express()
  .use(express.static(path.join(__dirname, 'public')))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')

  // -- INFO PAGES --
  .get('/', (req, res) => res.render('pages/index'))
  .get('/settings', (req, res) => res.render('pages/settings'))
  // -- INFO PAGES --

  // -- DEVICE PAGES --
  .get('/device', (req, res) => {
    let name = req.query.name;

    if (name != undefined) {
      if(!utils.stringValidation(name)) {res.send("<script>window.location.href = '/';</script>"); return;}
      res.render('pages/device', { req: req });
    } else {
      res.send("<script>window.location.href = '/';</script>");
    }
  })
  .get('/pair', (req, res) => res.render('pages/pair'))
  .get('/forget', function (req, res) {
    let name = req.query.name;

    if (name != undefined) {
      if(!utils.stringValidation(name)) {res.send("<script>window.location.href = '/';</script>");}

      res.send(`<body><script>
      if(localStorage.getItem("device-list") != null){
        const devices = JSON.parse(localStorage.getItem("device-list"));
        let i = 0;
        let found = -1;
        devices.forEach(listing => {
          if (listing.name == "${name}") {
            found = i;
          }
          i++;
        });
        if (found > -1){
          devices.splice(found, 1);
        }
        localStorage.setItem("device-list", JSON.stringify(devices));
      }
      window.location.href = '/';
      </script></body>`);
    }
  })
  // -- DEVICE PAGES --
  
  // -- DEVICE CALLS --
  .get('/device-connect', function(req,res){
    res.send('OK');
    let id = req.query.id;
    if (id != undefined) {
      registerDevice(id);
    }
  })
  .get('/device-ping', function(req, res){
    let id = req.query.id;
    if (id != undefined) {
      pingDevice(id);
      res.json({"action":fetchAction(id)});
    }
  })
  // -- DEVICE CALLS --

  .listen(PORT, () => console.log(`Listening on ${ PORT }`));
// -- EXPRESS SETUP --

var io = require('socket.io')(app);

// -- CLASSES --
class Device {
  id="";
  pingTime=0;

  constructor(id) {this.id = id;this.pingTime = Date.now();}
  ping() {this.pingTime = Date.now();}
}
// -- CLASSES --

// -- DATA --
var devices = [];

// device ID : [socket ID]
var listeningSockets = {};

// device ID : [action]
var actionQueue = {};

// -- DATA --

// -- DEVICE FUNCTIONS --
function fetchAction(deviceId){
  if(actionQueue[deviceId] !== undefined)
  {
    var action = actionQueue[deviceId].shift();
    if(action == undefined){
      return "";
    } else {
      console.log("Sent action: " + action);
      return action;
    }
  }
}

function pingDevice(id) {
  let i = 0;
  let found = -1;
  devices.forEach(device => {
    if(device.id == id){
      found = i;
    }
    i++;
  });

  if(found > -1){
    devices[found].ping();
  } else {
    console.log("Could not find device with id: " + id);
    registerDevice(id);
  }
}

function deregisterDevice(id) {
  let i = 0;
  let found = -1;
  devices.forEach(device => {
    if(device.id == id){
      found = i;
    }
    i++;
  });

  if(found > -1){
    let id = devices[found].id;
    if(listeningSockets[id]){
      listeningSockets[id].forEach((sId) => {
        io.to(sId).emit("deviceLost");
      });
    }

    devices.splice(found, 1);
  }

  delete actionQueue[id];
}

function registerDevice(id) {
  devices.push(new Device(id));

  actionQueue[id] = [];

  if(listeningSockets[id]){
    listeningSockets[id].forEach((sId) => {
      io.to(sId).emit("deviceConnected");
    });
  }
}

// this will count any devices that dont ping in 4s as disconnected
function heartbeat(){
  devices.forEach(device => {
    if(Date.now() - device.pingTime > 1500){
      console.log("Deregistered due to lack of ping: " + device.id + " (" + (Date.now() - device.pingTime) + "ms from last ping)");
      deregisterDevice(device.id);
    }
  });
}

setInterval(heartbeat, 1000);
// -- DEVICE FUNCTIONS --

io.on('connection', async(socket) => {
  let targetDevice = "";

  console.log("[SOCKET.IO] Connection");

  socket.on('registerListen', async(deviceId) => {
    if(listeningSockets[deviceId]){
      listeningSockets[deviceId].push(socket.id);
    } else {
      listeningSockets[deviceId] = [socket.id];
    }
    
    targetDevice = deviceId;
    console.log("[SOCKET.IO] Registered listen for: " + deviceId);
  });

  socket.on('isDeviceConnected', async(deviceId, callback) => {
    let i = 0;
    let found = -1;
    devices.forEach(device => {
      if(device.id == deviceId){
        found = i;
      }
      i++;
    });

    if(found > -1){
      callback(true);
    } else {
      callback(false);
    }
  });

  socket.on('pushAction', (action) => {
    if(actionQueue[targetDevice] !== undefined)
    {
      actionQueue[targetDevice].push(action);
    }
  });

  io.on('disconnect', () => {
    if(listeningSockets[targetDevice])
    {
      const indexOfObject = listeningSockets[targetDevice].findIndex((sId) => {
        return sId == socket.id;
      });
      if(indexOfObject > -1) {
        listeningSockets[targetDevice].splice(indexOfObject, 1);
      }
    }
  });
});