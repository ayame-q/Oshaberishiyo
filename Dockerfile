FROM node:22-alpine

WORKDIR /usr/src/app

COPY ./package.json /usr/src/app/
COPY ./yarn.lock /usr/src/app/
RUN yarn install --frozen-lockfile

COPY . /usr/src/app
COPY ./entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod 755 /usr/local/bin/entrypoint.sh

ENTRYPOINT [ "entrypoint.sh" ]
CMD yarn start
