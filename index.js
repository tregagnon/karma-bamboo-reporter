var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');

var fE;

var bambooReporter = function (baseReporterDecorator, config, formatError) {
    fE = formatError;
    baseReporterDecorator(this);

    var filename = config && config.filename || 'mocha.json';

    var results = {
        time: 0, tests: [], failures: [], passes: [], skips: []
    };

    this.onRunStart = function () {
        this._browsers = []; // Used by Karma
        this.startDate = new Date().toISOString();
        if (fs.existsSync(filename)) {
            fs.unlinkSync(filename);
        }
    };

    this.onSpecComplete = function (browser, result) {
        results.time += result.time;
        result.browser = browser.name;
        results.tests.push(result);
        if (result.skipped) results.skips.push(result);
        else if (result.success) results.passes.push(result);
        else results.failures.push(result);
    };

    this.onRunComplete = function (browser, runResult) {

        var obj = {
            stats: {
                tests: (runResult.success + runResult.failed + results.skips.length),
                passes: runResult.success,
                pending: results.skips.length,
                failures: runResult.failed,
                start: this.startDate,
                end: new Date().toISOString(),
                duration: results.time
            },
            failures: results.failures.map(clean),
            passes: results.passes.map(clean),
            skipped: results.skips.map(clean)
        };

        // If the directoy we're supposed to write into does not exist, create it
        var dir = path.dirname(filename);
        if (dir !== '.') {
            mkdirp.sync(dir);
        }

        fs.writeFileSync(filename, JSON.stringify(obj, null, 2), 'utf-8');
        results = {
            time: 0, tests: [], failures: [], passes: [], skips: []
        };
    };
};

function clean(test) {
    var o = {
        title    : test.description,
        fullTitle: test.suite.concat(test.description).join(' ')
    };

    if (!test.skipped) {
        o.duration = test.time;
    }

    if (!test.success && !test.skipped) {
        o.error = '';
        test.log.forEach(function(log) {
          // translate sourcemap
          log = fE(log);
          o.error += log.split('\n').reduce(function(memo, line, i) {
            // keep first line
            line = line.split('<-');
            if (line[1]) memo += '\n\tat' + line[1];
            return memo;
          });
        });
    }
    return o;
}

bambooReporter.$inject = ['baseReporterDecorator', 'config.bambooReporter', 'formatError'];

// PUBLISH DI MODULE
module.exports = {
    'reporter:bamboo': ['type', bambooReporter]
};
