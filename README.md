# lululemon-geolocate
Interview problem from Lululemon - take in an input CSV file, call an API endpoint to get geolocation information, generate an output JSON file that contains the results.

# NodeJS Test Project

Write a script that geolocates some of our lululemon store locations!

This script should iterate through the `input.csv` csv file, and query the [PositionStack API](https://positionstack.com/documentation#forward_geocoding) for the required data.

You should populate output.json with the required data from the responses.
The first entry is completed for you as an example:

 ```json
{
  "00120": {
    "street_address": "970 Robson Street",
    "locality": "Vancouver",
    "region": "British Columbia",
    "country": "Canada",
    "geopoint": {
      "lat": 49.283026,
      "long": -123.122826
    }
  }
}
```

## Test Guidelines

- You are encouraged to use the entire internet during this test. Searching for libraries and documentation is part of software development.
- Learning specific package managers or libraries is not part of the test, use whatever you like.
- Token creation is not part of the test, if you have trouble with your token please ask for help.
- Feel free to ask for clarification during the test.

Completion Milestones:

Feel free to do parts in any order.

1. CSV Parsed
    - You should not edit `input.csv`, and your program should read this file during it's operation.
2. Geolocation Queried
    - Your program successfully locates a store.
3. JSON Written
    - Your program outputs the desired json file `output.json`. Feel free to write over or append data to this file, but do not change it's schema.


## Documentation

[PositionStack API](https://positionstack.com/documentation#forward_geocoding)

## Notes

It seems the positionstack free API does not support `https` so you will need to use the `http` endpoint.

If there are multiple responses from the geolocation API, use only the first one.
