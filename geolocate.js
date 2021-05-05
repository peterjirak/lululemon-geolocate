'use strict';

const inputCsv = './input.csv';
const outputJson = './output.json';

const apiKey = '5f3cfb853822b89185fb37befa70904c';
const baseUrl = 'http://api.positionstack.com';

let outputJsonObj = null;
let lineCount = 0;

// Complete me!
// Notes:
// 1. How to handle it if output.json already exists:
//
//    I have decided in my implementation that if output.json already exists,
//    then the program will load the contents of output.json. As it goes through
//    the lines in input.csv if it encounters a store number for which it has
//    already performed the geolocate operation according to the data in the
//    existing output.json, then it skips the operation for that given store
//    number. It assumes the results in output.json are correct.
//
//    So this implementation is stateful.
//
// 2. Use of axios:
//
//    axios is a promise based HTTP client for both browser-side JavaScript and
//    server-side Node.JS.
//
//    https://www.npmjs.com/package/axios

const fs = require('fs');
const axios = require('axios');
const isEmpty = require('lodash.isempty');
const Mutex = require('async-mutex').Mutex;

function loadOutputJson(filename) {
    let outputJsonText = null;
    try {
        outputJsonText = fs.readFileSync(filename, 'utf8');
    } catch(err) {
        console.error(
            `Failed to read in the file: ${filename}: ${err}`
        );
        throw(err);
    }

    if (!outputJsonText) {
        console.error(
            `No data loaded from ${filename}`
        );
        throw(new TypeError(`No data loaded from ${filename}`));
    }

    let jsonObj = null;
    try {
        jsonObj = JSON.parse(outputJsonText);
    } catch (err) {
        if (err instanceof SyntaxError) {
            const failureMsg = `Failed to load the data from the file ` +
                               `${filename}. That file does not contain a ` +
                               `valid JSON object: ${err}`
            console.error(
                failureMsg
            );
            throw(failureMsg);
        } else {
            const failureMsg = `Failure encountered while attempting to ` +
                               `JSON parse data from the file ` +
                               `${filename}: ${err}`;
                               console.error(
                                failureMsg
                            );
                            throw(failureMsg);
                        }
    }

    if (!jsonObj) {
        throw( new InternalError(`Failed to load valid JSON data ` +
                                 `from ${filename}.`));
    }

    return jsonObj;
}

function getOutputJsonObject(filename) {
    try {
        if (fs.existsSync(filename)) {
            return loadOutputJson(filename);
        } else {
            return {};
        }
    } catch (err) {
        console.error(err);
        throw(err);
    }
}

function extractResponsePayload(response) {
    if (!response.data || !response.data.data ||
        response.data.data.length < 1 || isEmpty(response.data.data[0])) {
        return null;
    } else {
        return response.data.data[0];
    }
}

function getHttpResponseHandler(storeNumber, address) {
    const handler = (response) => {
        const data = extractResponsePayload(response);
        if (!data) {
            const warningMsg = `SKIPPING STORE ${storeNumber}: Failed to get ` +
                               `a response that has data from API endpoint. ` +
                               `No result retrieved for the address ` +
                               `${address}. The given store will be omitted ` +
                               `from the result set.`;
            console.warn(warningMsg);
        } else {
            // AXIOS yields an immutable response. Attempting to modify it will
            // yield a fatal exception. We know what the shape of that data is
            // supposed to be, so we use the spread operator to make a copy of it.
            let geoLocationObj = {...data};

            const latitude = geoLocationObj.latitude;
            const longitude = geoLocationObj.longitude;

            delete geoLocationObj.latitude;
            delete geoLocationObj.longitude;

            // The type property in the object returned from the HTTP GET API
            // endpoint just indicates the type of the query performed. Based on
            // our example input.csv, it appears that this may always be of type
            // 'address'. This data is not useful nor interesting, but could
            // potentially be distracting or confusing. Let's just go ahead
            // and delete it:
            delete geoLocationObj.type;

            if (!latitude && latitude !== 0) {
                const warningMsg = `OMITTING geopoint for STORE ` +
                                   `${storeNumber}. The data received ` +
                                   `from the HTTP GET request for the address ` +
                                   `'${address}' does not contain a valid latitude.`;
                console.warn(warningMsg);
            } else if (!longitude && longitude !== 0) {
                const warningMsg = `OMITTING geopoint for STORE ` +
                                   `${storeNumber}. The data received ` +
                                   `from the HTTP GET request for the address ` +
                                   `'${address}' does not contain a valid longitude.`;
                console.warn(warningMsg);
            } else {
                const geopoint = {
                    lat: latitude,
                    long: longitude
                };
                geoLocationObj.geopoint = geopoint;
            }

            let resultObj = {
                [storeNumber]: geoLocationObj
            };
            let resultStr = JSON.stringify(resultObj, null, 4);
            resultStr = resultStr.replace(/^\{/, '');

            // We have the text that contains the geolocate data for the
            // given store.
            //
            // We need to write that to the output JSON file. However, we
            // want any other asynchronous calls to wait so that two
            // asynchronous calls are not trying to update the same file at the
            // same time.
            //
            // Additionally, on the final update we need a closing brace to
            // close the outer object.
            //
            // To handle this correctly, we simply output that closing brace
            // every single time. However, aqs a part of each file update,
            // before we append to the file, we shorten it by a single character,
            // the closing brace character.
            //
            // Effectively each time we append to the file we first strip off any
            // former closing brace character off the end of the file.
            //
            // This means the output JSON file will always contain a valid JSON
            // object.
            const mutex = new Mutex();
            mutex
                 .acquire()
                 .then(
                     (release) => {
                         const outputFileStats = fs.statSync(outputJson);
                         fs.truncateSync(outputJson, outputFileStats.size);
                         fs.appendFileSync(outputJson, `,${resultStr}`, {encoding: 'utf8', mode: 0o640});
                         release();
                     }
                 )
        }
    }

    return handler;
}

function geolocateStoreAddress(storeNumber, address) {
    const responseHandler = getHttpResponseHandler(storeNumber, address);
    const url = '/v1/forward';
    const axiosRequest = {
        method: 'get',
        baseUrl: baseUrl,
        url: `${baseUrl}${url}`,
        params: {
            access_key: apiKey,
            query: address
        }
    };

    axios(
        axiosRequest
    ).then(
        responseHandler
    ).catch(
        (err)=> {
            const failureMsg = `Attempt to make HTTP GET request to ` +
                               `${baseUrl}${url} to query for address ` +
                               `${address} failed: ${err}`;
            console.error(failureMsg);
            throw(new Error(failureMsg));
        }
    );
}

function processLine(line) {
    lineCount += 1;
    line = line.trim();
    if (lineCount === 1) {
        if (line.toLowerCase() !== 'store,address') {
            throw(new SyntaxError(`The first line of the input CSV file ` +
                                  `${inputCsv} is not the header 'Store,Address'.`));
        }
    } else {
        const matches = line.match(/^([0-9]+),(.+)$/);
        if (!matches) {
            throw(new SyntaxError(`Error encountered on line number ${lineCount} ` +
                                  `in file ${inputCsv}. Expected a store number, ` +
                                  `followed by a comma, followed by an address. ` +
                                  `Line was not as expected.`));
        }

        const storeNumber = matches[1];
        const inputAddress = matches[2].trim();

        if (outputJsonObj[storeNumber]) {
            console.log(
                `Skipping line number ${lineCount} in the file ${inputCsv}. ` +
                `That line is for store number ${storeNumber}, but we ` +
                `previously already performed the geolocate operation for that store.`
            );
        } else {
            geolocateStoreAddress(storeNumber, inputAddress);
        }
    }
}

function main() {
    if (!fs.existsSync(inputCsv)) {
        const failureMsg = `The input CSV file ${inputCsv} does not exist.`;
        console.error(failureMsg);
        throw(new TypeError(failureMsg));
    }
    const inputFileStats = fs.statSync(inputCsv);
    if (inputFileStats.isDirectory()) {
        const failureMsg = `${inputCsv} was specified as the input CSV file. ` +
                           `However, that path is a directory and not a file.`;
        console.error(failureMsg);
        throw(new TypeError(failureMsg));
    }
    outputJsonObj = getOutputJsonObject(outputJson);
    let outputFileDescriptor = null;
    try {
        outputFileDescriptor = fs.openSync(outputJson, 'w', 0o640);
    } catch (err) {
        const failureMsg = `Failed to open ${outputJson} for writing: ${err}`;
        console.error(failureMsg);
        throw(err);
    }
    let outputJsonStr = JSON.stringify(outputJsonObj, null, 4);
    if (!outputJsonStr.match(/\}$/)) {
        const failureMsg = `The last character when we dump the output JSON ` +
                           `object is not a closing curly brace (which ` +
                           `indicates the end of an object). Cannot continue.`;
        console.error(failureMsg);
        throw(new SyntaxError(failureMsg));
    }

    const lineReader = require('line-reader');
    lineReader.eachLine(inputCsv, processLine);
}

try {
    main();
} catch (err) {
    if (err) {
        const failureMsg = `Attempt to perform the geolocate operation given ` +
                           `the input file '${inputCsv}' failed: ${err}`;
        console.error(failureMsg);
    }
}

if (outputJson && fs.existsSync(outputJson)) {
    // The output JSON file exists.
    const outputFileStats = fs.statSync(outputJson);
    if (outputFileStats.isDirectory()) {
        const failureMsg = `${outputJson} was specified as the output JSON ` +
                           `file. However, that path is a directory and ` +
                           `not a file.`;
        console.error(failureMsg);
        throw(new TypeError(failureMsg));
    } else {
//        console.log(`Append closing curly brace on to the end of the ` +
//                    `contents ${outputJson}`);
//        fs.appendFileSync(outputJson, "\n}", {encoding: 'utf8', mode: 0o640});
    }
} else {
    const failureMsg = `geolocate.js did not generate the output file ${outputJson}.`;
    console.error(failureMsg);
    throw(new Error(failureMsg));
}