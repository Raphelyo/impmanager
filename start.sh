#!/bin/bash
set -e

echo "[Start] Iniciando Firebird Server..."
/etc/init.d/firebird3.0 start
sleep 2

echo "[Start] Criando diretorios persistentes..."
mkdir -p /data/db /data/uploads/logos /data/uploads/fdb

echo "[Start] Iniciando aplicacao..."
exec node server.js
