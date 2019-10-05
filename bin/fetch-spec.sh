#!/bin/bash -x

VERSION="${1:-1.15.4}"

curl -s https://kubernetesjsonschema.dev/v${VERSION}/_definitions.json -o spec/v${VERSION}.json
