console.log("Starting...");

const fs = require('fs');
const readline = require('readline');
const stc = require('string-to-color');
const nearestColor = require('nearest-color').from({
    1: "#7986cb",
    2: "#33b679",
    3: "#8e24aa",
    4: "#e67c73",
    5: "#f6c026",
    6: "#f5511d",
    7: "#039be5",
    8: "#616161",
    9: "#3f51b5",
    10: "#0b8043",
    11: "#d60000"
});
const {google} = require('googleapis');
const zermeloPrivateAPI = require('./zermelo-private-api.js');

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const SCOPES_ADMIN = SCOPES.concat(['https://www.googleapis.com/auth/admin.directory.user.readonly']);
const TOKEN_PATH = __dirname + '/token.json';
const SERVICE_JSON = __dirname + '/service.json';
const CREDENTIALS_PATH = __dirname + '/credentials.json';
const CREDENTIALS_Z_PATH = __dirname + '/credentials-z.json';
let servicePrivateKey = require('./service.json');

function authorize(credentials, callback) {
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    fs.readFile(TOKEN_PATH, function(err, token) {
        if (err) return getAccessToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    });
}

function getAccessToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES_ADMIN
    });
    console.log("Authorize this app by visiting this URL: ", authUrl);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question("Enter the code from that page here: ", function(code) {
        rl.close();
        oAuth2Client.getToken(code, function(err, token) {
            if (err) return console.error("Error retrieving access token", err);
            oAuth2Client.setCredentials(token);
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), function(err) {
                if (err) return console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
            callback(oAuth2Client);
        });
    });
}

function updateCalendar(auth) {
    const calendar = google.calendar({version: 'v3', auth});

    console.log("Creating Google Admin SDK Service...");
    const adminService = google.admin({ version: "directory_v1", auth });

    console.log("Retrieving Zermelo lessons...");
    let zermeloCredentials = JSON.parse(fs.readFileSync(CREDENTIALS_Z_PATH));

    zermeloPrivateAPI.setSchool(zermeloCredentials.school);
    zermeloPrivateAPI.setBranchOfSchool(zermeloCredentials.branch);
    zermeloPrivateAPI.setApiToken(zermeloCredentials.token);

    zermeloPrivateAPI.getUpcomingAppointments()
        .then(function(schedule) {
            console.log("Lessons fetched");
            let lessonCount = schedule.length;
            // lessonCount = 3;    /* for debugging */
            preAddToCalender(adminService, auth, calendar, schedule, 0, lessonCount);
        }).catch(function(err) {
            console.error(err);
        });
}

function iterateNextLesson(adminService, auth, calendar, schedule, i, lessonCount) {
    i++;
    if (i < lessonCount) {
        console.log("Another round incoming");
        setTimeout(function() {
            console.log("Running now");
            preAddToCalender(adminService, auth, calendar, schedule, i, lessonCount);
        }, 100);
    }
}

function addToCalendar(userAuth, calendar, lesson) {
    return new Promise(function(resolve, reject) {
        calendar.events.get({
            auth: userAuth,
            calendarId: 'primary',
            eventId: 'damstederooster'+lesson['appointmentInstance']
        }, function(err, res) {
            if (err) {
                // event does not exist yet, create it
                let calEvent = {
                    id: 'damstederooster'+lesson['appointmentInstance'],
                    summary: lesson["subjects"].join(", ").toUpperCase() + " van " + lesson["teachers"].join(", ").toUpperCase(),
                    description: "<b>" + lesson["subjects"].join(", ").toUpperCase() + " van " + lesson["teachers"].join(", ").toUpperCase() + " aan " + lesson["groups"].join(", ").toUpperCase() + "</b>" + (lesson["changeDescription"] ? "<br><br>"+lesson["changeDescription"] : ""),
                    location: lesson["locations"].join(", "),
                    colorId: parseInt(nearestColor(stc(lesson["subjects"][0]))["name"]),
                    start: {
                        dateTime: new Date(lesson["start"] * 1000).toISOString(),
                        timeZone: "Europe/Amsterdam"
                    },
                    end: {
                        dateTime: new Date(lesson["end"] * 1000).toISOString(),
                        timeZone: "Europe/Amsterdam"
                    },
                    attendees: [
                        {
                            email: "systeembeheer@damstede.eu",
                            displayName: "Systeembeheer Damstede",
                            optional: true,
                            responseStatus: "declined",
                            comment: "Systeembeheer neemt geen deel aan de les, maar is wel toegevoegd om eventueel de les te kunnen ondersteunen."
                        }
                    ],
                    guestsCanInviteOthers: false,
                    guestsCanModify: false,
                    guestsCanSeeOtherGuests: true,
                    reminders: {
                        useDefault: false,
                        overrides: [
                            {
                                method: 'email',
                                minutes: 10
                            }
                        ]
                    },
                    source: {
                        title: "Zermelo Rooster",
                        url: "https://damstedelyceum.zportal.nl/"
                    },
                    status: (lesson["cancelled"] ? "cancelled" : "confirmed"),
                    conferenceData: {
                        createRequest: {
                            requestId: lesson['appointmentInstance']
                        }
                    }
                };

                for (let d = 0; d < lesson["teachers"].length; d++) {
                    calEvent.attendees.push({
                        email: lesson["teachers"][d] + "@damstede.eu"
                    });
                }
                for (let d = 0; d < lesson["students"].length; d++) {
                    calEvent.attendees.push({
                        email: "n" + lesson["students"][d] + "@damstede.eu"
                    });
                }

                calendar.events.insert({
                    auth: userAuth,
                    calendarId: 'primary',
                    resource: calEvent
                }, function(errInsert, newEvent) {
                    if (errInsert) {
                        reject("There was an error contacting the calendar service", errInsert);
                        return;
                    }
                    
                    console.log("Lesson added");
                    resolve();
                });
            }
            else {
                // event exists, update it (if needed)
                console.log("Lesson already exists in the schedule! Updating info (if needed)...");
                if (lesson["teachers"].length > 0 && lesson["students"].length > 0) {
                    let calEvent = {
                        status: (lesson["cancelled"] ? "cancelled" : "confirmed"),
                        summary: lesson["subjects"].join(", ").toUpperCase() + " van " + lesson["teachers"].join(", ").toUpperCase(),
                        description: "<b>" + lesson["subjects"].join(", ").toUpperCase() + " van " + lesson["teachers"].join(", ").toUpperCase() + " aan " + lesson["groups"].join(", ").toUpperCase() + "</b>" + (lesson["changeDescription"] ? "<br><br>"+lesson["changeDescription"] : ""),
                        location: lesson["locations"].join(", "),
                        colorId: parseInt(nearestColor(stc(lesson["subjects"][0]))["name"]),
                        start: {
                            dateTime: new Date(lesson["start"] * 1000).toISOString(),
                            timeZone: "Europe/Amsterdam"
                        },
                        end: {
                            dateTime: new Date(lesson["end"] * 1000).toISOString(),
                            timeZone: "Europe/Amsterdam"
                        },
                        attendees: [
                            {
                                email: "systeembeheer@damstede.eu",
                                displayName: "Systeembeheer Damstede",
                                optional: true,
                                responseStatus: "declined",
                                comment: "Systeembeheer neemt geen deel aan de les, maar is wel toegevoegd om eventueel de les te kunnen ondersteunen."
                            }
                        ]
                    };
                    for (let d = 0; d < lesson["teachers"].length; d++) {
                        calEvent.attendees.push({
                            email: lesson["teachers"][d] + "@damstede.eu"
                        });
                    }
                    for (let d = 0; d < lesson["students"].length; d++) {
                        calEvent.attendees.push({
                            email: "n" + lesson["students"][d] + "@damstede.eu"
                        });
                    }
                    calendar.events.patch({
                        auth: userAuth,
                        calendarId: 'primary',
                        eventId: 'damstederooster'+lesson['appointmentInstance'],
                        resource: calEvent
                    });
                }
                else {
                    calendar.events.patch({
                        auth: userAuth,
                        calendarId: 'primary',
                        eventId: 'damstederooster'+lesson['appointmentInstance'],
                        resource: {
                            status: "cancelled"
                        }
                    });
                }

                console.log("Lesson modified");
                resolve();
            }
        });
    });
}

function preAddToCalender(adminService, auth, calendar, schedule, i, lessonCount) {
    console.log("Adding " + i + " to calendar... ("+(lessonCount - i - 1) + " remaining)");
    if (schedule[i]["teachers"].length > 0 && schedule[i]["students"].length > 0) {
        console.log("Retrieving account for "+schedule[i]["teachers"][0]+"...");
        adminService.users.get({
            userKey: schedule[i]["teachers"][0]+"@damstede.eu"
        }, function(err, res) {
            if (err) {
                console.warn("User does not exist. The teacher code might not have been added as an alias to an account in your organization.");
                iterateNextLesson(adminService, auth, calendar, schedule, i, lessonCount);
            }
            else {
                for (let em = 0; em < res.data.emails.length; em++) {
                    if (res.data.emails[em]["primary"] === true) {
                        console.log("Logging in as "+res.data.emails[em]["address"]+"...");
                        let jwtClient = new google.auth.JWT(servicePrivateKey.client_email, SERVICE_JSON, servicePrivateKey.private_key, SCOPES, res.data.emails[em]["address"]);
                        jwtClient.authorize(function(err, res) {
                            if (err) {
                                console.error(err);
                                console.log("Could not login as user. Adding lesson to the admin calendar instead...");

                                addToCalendar(auth, calendar, schedule[i])
                                    .then(function() {
                                        // logging happens in addToCalendar()
                                    })
                                    .catch(function(errMsg, err) {
                                        console.error(errMsg, err);
                                    })
                                    .finally(function() {
                                        iterateNextLesson(adminService, auth, calendar, schedule, i, lessonCount);
                                    });
                            }
                            else {
                                console.log("Adding lesson to user's calendar...");
                                addToCalendar(jwtClient, calendar, schedule[i])
                                    .then(function() {
                                        // logging happens in addToCalendar()
                                    })
                                    .catch(function(errMsg, err) {
                                        console.error(errMsg, err);
                                    })
                                    .finally(function() {
                                        iterateNextLesson(adminService, auth, calendar, schedule, i, lessonCount);
                                    });
                            }
                        });
                        return;
                    }
                }
            }
        });
        return;
        
    }
    else {
        console.log("Lesson does not contain students or teachers!");
        iterateNextLesson(adminService, auth, calendar, schedule, i, lessonCount);
    }
}

fs.readFile(CREDENTIALS_PATH, function(err, content) {
    if (err) return console.log('Error loading client secret file: ', err);
    authorize(JSON.parse(content), updateCalendar);
});