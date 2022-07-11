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
      if(localStorage.getItem("device-list") !== null){
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
    res.send('OK');
    let id = req.query.id;
    if (id != undefined) {
      pingDevice(id);
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
}
// -- CLASSES --

// -- DATA --
var devices = [];

// device ID : socket ID
var listeningSockets = [];

// -- DATA --

// -- DEVICE FUNCTIONS --
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
    devices[found].pingTime = Date.now();
  } else {
    console.log("Could not find device with id: " + id);
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
      io.to(listeningSockets[id]).emit("deviceLost");
    }

    devices.splice(found, 1);
  }
}

function registerDevice(id) {
  devices.push(new Device(id));

  if(listeningSockets[id]){
    io.to(listeningSockets[id]).emit("deviceConnected");
  }
}

// this will count any devices that dont ping in 4s as disconnected
function heartbeat(){
  devices.forEach(device => {
    if(Date.now() - device.pingTime > 4000){
      deregisterDevice(device.id);
    }
  });
}

setInterval(heartbeat, 4000);
// -- DEVICE FUNCTIONS --

io.on('connection', async(socket) => {
  let targetDevice = "";

  io.on('registerListen', async(deviceId) => {
    listeningSockets[deviceId] = socket.id;
    targetDevice = deviceId;
  });

  io.on('disconnect', () => {
    if(listeningSockets[targetDevice])
    {
      delete listeningSockets[targetDevice];
    }
  });
});