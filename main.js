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
const TOKEN_PATH = 'token.json';

fs.readFile('credentials.json', function(err, content) {
    if (err) return console.log('Error loading client secret file: ', err);
    authorize(JSON.parse(content), updateCalendar);
});

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
        scope: SCOPES
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

    let zermeloCredentials = JSON.parse(fs.readFileSync("credentials-z.json"));

    zermeloPrivateAPI.setSchool(zermeloCredentials.school);
    zermeloPrivateAPI.setBranchOfSchool(zermeloCredentials.branch);
    zermeloPrivateAPI.setApiToken(zermeloCredentials.token);

    zermeloPrivateAPI.getUpcomingAppointments()
        .then(function(schedule) {
            let lessonCount = schedule.length;
            addToCalendar(auth, calendar, schedule, 0, lessonCount);
            console.log("Done");
        }).catch(function(err) {
            console.error(err);
        });
}

function addToCalendar(auth, calendar, schedule, i, lessonCount) {
    console.log("Adding " + i + " to calendar... ("+(lessonCount - i - 1) + " remaining)");
    // console.log(schedule[i]);
    if (schedule[i]["teachers"].length > 0 && schedule[i]["students"].length > 0) {
        calendar.events.get({
            calendarId: 'damstede.eu_dtdrvnpojua3snqiqlcs2a64fc@group.calendar.google.com',
            eventId: 'damstederooster'+schedule[i]['appointmentInstance']
        }, function(err, res) {
            if (err) {
                // event does not exist yet, create it
                let calEvent = {
                    id: 'damstederooster'+schedule[i]['appointmentInstance'],
                    summary: schedule[i]["subjects"].join(", ").toUpperCase() + " van " + schedule[i]["teachers"].join(", ").toUpperCase(),
                    description: "<b>" + schedule[i]["subjects"].join(", ").toUpperCase() + " van " + schedule[i]["teachers"].join(", ").toUpperCase() + " aan " + schedule[i]["groups"].join(", ").toUpperCase() + "</b>" + (schedule[i]["changeDescription"] ? "<br><br>"+schedule[i]["changeDescription"] : ""),
                    location: schedule[i]["locations"].join(", "),
                    colorId: parseInt(nearestColor(stc(schedule[i]["subjects"][0]))["name"]),
                    start: {
                        dateTime: new Date(schedule[i]["start"] * 1000).toISOString(),
                        timeZone: "Europe/Amsterdam"
                    },
                    end: {
                        dateTime: new Date(schedule[i]["end"] * 1000).toISOString(),
                        timeZone: "Europe/Amsterdam"
                    },
                    attendees: [

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
                    status: (schedule[i]["cancelled"] ? "cancelled" : "confirmed"),
                    conferenceData: {
                        createRequest: {
                            requestId: schedule[i]['appointmentInstance']
                        }
                    }
                };

                for (let d = 0; d < schedule[i]["teachers"].length; d++) {
                    calEvent.attendees.push({
                        email: schedule[i]["teachers"][d] + "@damstede.eu"
                    });
                }
                for (let d = 0; d < schedule[i]["students"].length; d++) {
                    calEvent.attendees.push({
                        email: "n" + schedule[i]["students"][d] + "@damstede.eu"
                    });
                }

                calendar.events.insert({
                    auth: auth,
                    calendarId: 'damstede.eu_dtdrvnpojua3snqiqlcs2a64fc@group.calendar.google.com',
                    resource: calEvent
                }, function(err, newEvent) {
                    if (err) {
                        console.error("There was an error contacting the calendar service: ", err);
                    }
                    console.log("Lesson created", i);
                    i++;
                    if (i < lessonCount) {
                        console.log("Another round incoming");
                        setTimeout(function() {
                            console.log("Running now");
                            addToCalendar(auth, calendar, schedule, i, lessonCount);
                        }, 100);
                    }
                });
            }
            else {
                // event exists, update it (if needed)
                console.log("Lesson already exists in the schedule! Updating info (if needed)...", i);
                if (schedule[i]["teachers"].length > 0 && schedule[i]["students"].length > 0) {
                    let calEvent = {
                        status: (schedule[i]["cancelled"] ? "cancelled" : "confirmed"),
                        summary: schedule[i]["subjects"].join(", ").toUpperCase() + " van " + schedule[i]["teachers"].join(", ").toUpperCase(),
                        description: "<b>" + schedule[i]["subjects"].join(", ").toUpperCase() + " van " + schedule[i]["teachers"].join(", ").toUpperCase() + " aan " + schedule[i]["groups"].join(", ").toUpperCase() + "</b>" + (schedule[i]["changeDescription"] ? "<br><br>"+schedule[i]["changeDescription"] : ""),
                        location: schedule[i]["locations"].join(", "),
                        colorId: parseInt(nearestColor(stc(schedule[i]["subjects"][0]))["name"]),
                        start: {
                            dateTime: new Date(schedule[i]["start"] * 1000).toISOString(),
                            timeZone: "Europe/Amsterdam"
                        },
                        end: {
                            dateTime: new Date(schedule[i]["end"] * 1000).toISOString(),
                            timeZone: "Europe/Amsterdam"
                        },
                        attendees: []
                    };
                    for (let d = 0; d < schedule[i]["teachers"].length; d++) {
                        calEvent.attendees.push({
                            email: schedule[i]["teachers"][d] + "@damstede.eu"
                        });
                    }
                    for (let d = 0; d < schedule[i]["students"].length; d++) {
                        calEvent.attendees.push({
                            email: "n" + schedule[i]["students"][d] + "@damstede.eu"
                        });
                    }
                    calendar.events.patch({
                        calendarId: 'damstede.eu_dtdrvnpojua3snqiqlcs2a64fc@group.calendar.google.com',
                        eventId: 'damstederooster'+schedule[i]['appointmentInstance'],
                        resource: calEvent
                    });
                }
                else {
                    calendar.events.patch({
                        calendarId: 'damstede.eu_dtdrvnpojua3snqiqlcs2a64fc@group.calendar.google.com',
                        eventId: 'damstederooster'+schedule[i]['appointmentInstance'],
                        resource: {
                            status: "cancelled"
                        }
                    });
                }

                i++;
                if (i < lessonCount) {
                    console.log("Another round incoming");
                    setTimeout(function() {
                        console.log("Running now");
                        addToCalendar(auth, calendar, schedule, i, lessonCount);
                    }, 100);
                }
            }
        });
    }
    else {
        console.log("Lesson does not contain students or teachers!");
        i++;
        if (i < lessonCount) {
            console.log("Another round incoming");
            setTimeout(function() {
                console.log("Running now");
                addToCalendar(auth, calendar, schedule, i, lessonCount);
            }, 100);
        }
    }
}