'use strict';

const inputCsv = './input.csv';
const outputJson = './output.json';

const apiKey = 'd54234f9b3b1ddf124c70cf33484e139';
const baseUrl = 'https://api.positionstack.com';

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

function getHttpResponseHandler(storeNumber, address) {
    const handler = (response) => {
        let resultObj = {
            storeNumber: response
        };
        let responseStr = JSON.stringify(resultObj);
        responseStr = responseStr.replace(/^\{/, '');
        responseStr = responseStr.replace(/\n\}$/, '');
        fs.appendFileSync(outputJson, responseStr, {encoding: 'utf8', mode: 0o640});
    }

    return handler;
}

function geolocateStoreAddress(storeNumber, address) {
    const responseHandler = getHttpResponseHandler(storeNumber, address);
    const url = '/v1/forward';
    const axiosRequest = {
        method: 'get',
        baseUrl: baseUrl,
        url: url,
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

    // I am dropping the closing curly brace from the output JSON string.
    // I will add a closing curly brace back in before this program completes.
    if (outputJsonStr === '{') {
        // I want the opening curly brace to be on the first line followed by a
        // newline character
        outputJsonStr = "{\n";
    } else {
        outputJsonStr = outputJsonStr.replace(/\n{0,1}\}$/, '');
    }

    let bytesWritten = null;

    try {
        bytesWritten = fs.writeSync(outputFileDescriptor, outputJsonStr, 0);
    } catch (err) {
        const failureMsg = `Attempt to write the partial result to ${outputJson} failed: ${err}`;
        console.error(failureMsg);
        throw(new InternalError(failureMsg));
    }

    if (bytesWritten < outputJsonStr.length) {
        const failureMsg = `Wrote ${bytesWritten} bytes to the ` +
                           `file ${outputJson}. Expected to write ` +
                           `${outputJsonStr.length} bytes to that file.`;
        console.error(failureMsg);
        throw(new InternalError(failureMsg));
    }

    try {
        fs.closeSync(outputFileDescriptor);
    } catch (err) {
        const failureMsg = `Failed to close the file descriptor for writing ` +
                           `to the file ${outputJson}: ${err}`;
        console.error(failureMsg);
        throw(new InternalError(failureMsg));
    }

    const lineReader = require('line-reader');
    lineReader.eachLine(inputCsv, processLine);
}

main();
