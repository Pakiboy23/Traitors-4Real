FROM alpine:3.23

ARG PB_VERSION=0.25.2
ARG TARGETARCH=amd64

RUN apk add --no-cache ca-certificates curl \
  && mkdir -p /pb \
  && curl -fsSL -o /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" \
  && unzip /tmp/pb.zip -d /pb \
  && rm -f /tmp/pb.zip \
  && chmod +x /pb/pocketbase

WORKDIR /pb

EXPOSE 8090

CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090"]
