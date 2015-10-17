/**
 * Created by metaory on 10/17/15.
 */

console.reset = function () {
    return process.stdout.write('\033c');
};
console.reset();

var fs = require('fs');
var c = require('colors');
var _ = require('lodash');
var Promise = require('promise');
var inquirer = require('inquirer');
var Table = require('cli-table');

var config = require('./config.json');

var Redis = require("redis"),
    redis = Redis.createClient();

var DB_ENV = {
    MASTER: 1,
    TEST: 2
};

var dbData = {
    "fight": [],
    "farm": [],
    "sup": [],
    "push": [],
    "vers": []
};
var dbRaw = null;


redis.select(DB_ENV.TEST, function (err) {
    if (err) throw "redis error - " + err;
});

function loadDb() {
    return new Promise(function (fulfill, reject) {
        var loadPromises = [];

        Object.keys(dbData).forEach(function (key) {
            loadPromises.push(new Promise(function (fulfill, reject) {
                redis.lrange("stat." + key, 0, -1, cb);
                function cb(err, data) {
                    if (err) reject(err);
                    else fulfill(data);
                }
            }));
        });

        Promise.all(loadPromises).then(dbLoad);
        function dbLoad(r) {
            dbRaw = r;
            Object.keys(dbData).forEach(function (key, i) {
                dbData[key] = r[i];
            });
            fulfill();
        }
    })
}

loadDb().then(mainMenu);

function mainMenu() {
    console.log("\n");
    inquirer.prompt([
        {
            type: "list",
            name: "action",
            choices: ["-input-".green, "-latest-".cyan, "-flush-".yellow, "-exit-".red],
            message: "action",
            filter: function (val) {
                return val.split('-')[1];
            }
        }
    ], function (ans) {
        switch (ans.action) {
            case "input":
                loadDb().then(statInput);
                break;
            case "latest":
                loadDb().then(listLatest);
                break;
            case "flush":
                confirm(function (res) {
                    if (res.confirm) flushDb();
                    mainMenu();
                });
                break;
            case "exit":
                process.exit();
                break;
        }
    })
}

function listLatest() {
    var table = new Table();
    Object.keys(dbData).forEach(function (key,i) {
        var obj = {};
        obj[key] = dbData[key].slice(0, config.LATEST_LIMIT);
        table.push(obj)
    });
    console.log(table.toString());
    mainMenu();
}

function statInput() {
    inquirer.prompt([

        {
            type: "input",
            name: "fight",
            message: "fighting",
            default: dbData["fight"][0],
            filter: function (val) { return parseInt(val); },
            validate: function (val) { return val.length > 0 && _.inRange(val, 0, 100) }
        }, {
            type: "input",
            name: "farm",
            message: "farming",
            default: dbData["farm"][0],
            filter: function (val) { return parseInt(val); },
            validate: function (val) { return val.length > 0 && _.inRange(val, 0, 100) }
        }, {
            type: "input",
            name: "sup",
            message: "supporting",
            default: dbData["sup"][0],
            filter: function (val) { return parseInt(val); },
            validate: function (val) { return val.length > 0 && _.inRange(val, 0, 100) }
        }
        , {
            type: "input",
            name: "push",
            message: "pushing",
            default: dbData["push"][0],
            filter: function (val) { return parseInt(val); },
            validate: function (val) { return val.length > 0 && _.inRange(val, 0, 100) }
        }
        , {
            type: "input",
            name: "vers",
            message: "versatility",
            default: dbData["vers"][0],
            filter: function (val) { return parseInt(val); },
            validate: function (val) { return val.length > 0 && _.inRange(val, 0, 100) }
        }
        , {
            type: "confirm",
            name: "confirm",
            message: "confirm db write",
            default: true
        }
    ], function (ans) {
        if (ans.confirm) {
            delete ans.confirm;
            update(ans).then(loadDb).then(listLatest);
        } else mainMenu();
    });

}

function update(upd) {
    return new Promise(function (fulfill, reject) {
        var promises = [];
        Object.keys(upd).forEach(function (key) {
            promises.push(new Promise(function (fulfill, reject) {
                redis.lpush('stat.' + key, upd[key], cb);
                function cb(err, data) {
                    if (err) reject(err);
                    else fulfill(data);
                }
            }));
        });
        Promise.all(promises).then(storeSuccess,storeFail);
        function storeSuccess(r){ fulfill(r); }
        function storeFail(err){ reject(err);}
    })
}


function confirm(cb) {
    inquirer.prompt([
        {
            type: "confirm",
            name: "confirm",
            message: "are you sure?",
            default: false
        }
    ], cb);

}

function flushDb() {
    redis.flushdb(function (err) {
        if (err) throw "redis error - " + err
    });
}

process.on('uncaughtException', function (err) {
    console.log('Caught exception: ' + err);
});
