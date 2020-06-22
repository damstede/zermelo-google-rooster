const https = require('https');
const fs = require('fs');

let subdomain = null;
let accessToken = null;
let branchOfSchool = null;

exports.setSchool = function(school) {
    subdomain = school;
};

exports.setApiToken = function(token) {
    accessToken = token;
};

exports.setBranchOfSchool = function(branch) {
    branchOfSchool = branch;
};

let getStartTimestamp = function() {
    return Math.floor((new Date().getTime()) / 1000);
};

let getEndTimestamp = function() {
    return Math.floor((new Date().getTime() + 86400000) / 1000);
};

let getHostName = function() {
    return subdomain+".zportal.nl";
};

let getPath = function(endPoint) {
    return "/api/v3/"+endPoint+"?access_token="+encodeURIComponent(accessToken);
};

let getApiUrl = function(endPoint) {
    return "https://"+getHostName()+getPath(endPoint);
};

exports.getUpcomingAppointments = function() {
    return new Promise(function(resolve, reject) {
        let req = https.request({
            hostname: getHostName(),
            port: 443,
            path: getPath("appointments") + "&valid=true&start="+getStartTimestamp()+"&end="+getEndTimestamp()+"&branchOfSchool="+branchOfSchool+"&fields=id,appointmentInstance,start,end,startTimeSlot,endTimeSlot,subjects,teachers,locations,students,groups,lastModified,new,cancelled,teacherChanged,groupChanged,locationChanged,timeChanged,changeDescription",
            method: 'GET'
        }, function(res) {
            let response = "";
            res.on('data', function(chunk) {
                response += chunk;
            });
            res.on('end', function() {
                try {
                    response = JSON.parse(response)["response"];
                    if (response["status"] == 200) {
                        fs.writeFile('zcache.json', JSON.stringify(response["data"]), 'utf8', function() {
                            resolve(response["data"]);
                        });
                    }
                    else {
                        reject(response["status"] + " " + response["message"] + " " + response["details"]);
                    }
                }
                catch(err) {
                    reject(err);
                }
            });
        })
        req.on('error', function(err) {
            reject(err);
        });
        req.end();
    });
};

exports.getLastUpcomingAppointments = function() {
    return new Promise(function(resolve, reject) {
        fs.readFile('zcache.json', 'utf8', function(err, data) {
            if (err) {
                resolve([]);
            }
            else {
                try {
                    var json = JSON.parse(data);
                    resolve(json);
                }
                catch (error) {
                    resolve([]);
                }
            }
        });
    });
};