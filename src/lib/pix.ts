/**
 * Utilitários para geração de Pix Copia e Cola no padrão BACEN EMV.
 */

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  crc &= 0xffff;
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function f(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

export function generatePixPayload({
  pixKey,
  amount,
  merchantName = "Novex Finance",
  merchantCity = "Sao Paulo",
  txId = "***",
}: {
  pixKey: string;
  amount?: number;
  merchantName?: string;
  merchantCity?: string;
  txId?: string;
}): string {
  // Limpar formatação da chave Pix
  let key = pixKey.trim();

  const payloadFormatIndicator = f("00", "01");
  const gui = f("00", "br.gov.bcb.pix");
  const keyField = f("01", key);
  const merchantAccountInformation = f("26", gui + keyField);
  const merchantCategoryCode = f("52", "0000");
  const transactionCurrency = f("53", "986");
  
  let transactionAmount = "";
  if (amount && amount > 0) {
    transactionAmount = f("54", amount.toFixed(2));
  }
  
  const countryCode = f("58", "BR");
  
  // Limitar tamanho do nome e cidade de acordo com o padrão
  const name = merchantName.substring(0, 25).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "");
  const city = merchantCity.substring(0, 15).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "");
  
  const merchantNameField = f("59", name);
  const merchantCityField = f("60", city);
  
  const referenceLabel = f("05", txId.substring(0, 25));
  const additionalDataFieldTemplate = f("62", referenceLabel);

  const payload =
    payloadFormatIndicator +
    merchantAccountInformation +
    merchantCategoryCode +
    transactionCurrency +
    transactionAmount +
    countryCode +
    merchantNameField +
    merchantCityField +
    additionalDataFieldTemplate +
    "6304"; // ID e Length do CRC

  const crc = crc16(payload);

  return payload + crc;
}
