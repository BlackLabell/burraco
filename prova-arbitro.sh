#!/bin/bash
# Prova end-to-end dell'arbitro sul server, una volta fatti i tre passi
# della guida (funzione entra_tavolo, edge function "tavolo", niente
# altro: vedi_tavolo esiste già).
#
# Serve `curl` e `jq` (su Mac: `brew install jq` se non c'è già).
#
# Uso:
#   chmod +x prova-arbitro.sh
#   ./prova-arbitro.sh

set -e
URL="${URL:-https://cpwodjykbfmyykybbtzm.supabase.co}"
CHIAVE="${CHIAVE:-sb_publishable_tnIBNo_liLN-ELDBf0mWdQ_rcv60A4O}"
FUNZIONE="$URL/functions/v1/tavolo"
REST="$URL/rest/v1/rpc"

chiama_funzione() {
  curl -sS -X POST "$FUNZIONE" \
    -H "Authorization: Bearer $CHIAVE" \
    -H "apikey: $CHIAVE" \
    -H "Content-Type: application/json" \
    -d "$1"
}
chiama_rpc() {
  curl -sS -X POST "$REST/$1" \
    -H "Authorization: Bearer $CHIAVE" \
    -H "apikey: $CHIAVE" \
    -H "Content-Type: application/json" \
    -d "$2"
}

echo "1) Alice apre il tavolo (edge function 'apri')..."
A=$(chiama_funzione '{"azione":"apri","nome":"Alice"}')
echo "$A" | jq .
CODICE=$(echo "$A" | jq -r .codice)
SEGRETO_A=$(echo "$A" | jq -r .segreto)
TURNO=$(echo "$A" | jq -r .turno)
echo "   codice: $CODICE — tocca al posto $TURNO"

echo ""
echo "2) Bob entra (funzione SQL 'entra_tavolo')..."
B=$(chiama_rpc entra_tavolo "{\"p_codice\":\"$CODICE\",\"p_nome\":\"Bob\"}")
echo "$B" | jq .
SEGRETO_B=$(echo "$B" | jq -r .segreto)

echo ""
echo "3) Un terzo che prova a entrare deve essere respinto (tavolo pieno)..."
chiama_rpc entra_tavolo "{\"p_codice\":\"$CODICE\",\"p_nome\":\"Carlo\"}" | jq .

echo ""
echo "4) Bob guarda il tavolo con il segreto sbagliato: deve fallire (funzione SQL 'vedi_tavolo')..."
chiama_rpc vedi_tavolo "{\"p_codice\":\"$CODICE\",\"p_posto\":1,\"p_segreto\":\"non-e-il-suo\"}" | jq .

echo ""
echo "5) Bob guarda il tavolo con il segreto giusto: deve vedere la propria mano..."
chiama_rpc vedi_tavolo "{\"p_codice\":\"$CODICE\",\"p_posto\":1,\"p_segreto\":\"$SEGRETO_B\"}" | jq .

if [ "$TURNO" = "0" ]; then SEGRETO_DI_TURNO=$SEGRETO_A; else SEGRETO_DI_TURNO=$SEGRETO_B; fi

echo ""
echo "6) Chi ha il turno ($TURNO) pesca dal tallone (edge function 'mossa')..."
chiama_funzione "{\"azione\":\"mossa\",\"codice\":\"$CODICE\",\"posto\":$TURNO,\"segreto\":\"$SEGRETO_DI_TURNO\",\"mossa\":{\"t\":\"p\",\"s\":\"stock\"}}" | jq .

echo ""
echo "Se tutte le risposte sopra hanno senso (Alice non vede mai le carte di"
echo "Bob e viceversa, i rifiuti sono arrivati con un errore chiaro, e la"
echo "pescata al punto 6 ha fatto salire 'versione' e allungato la mano),"
echo "l'arbitro sul server funziona."
