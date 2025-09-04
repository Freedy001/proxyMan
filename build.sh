#cd frontend && npm run build
#cd ..
go build -o proxyMan
export GOOS=linux
export GOARCH=amd64
go build -o proxyMan-amd64-linux