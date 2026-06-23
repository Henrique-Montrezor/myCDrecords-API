import NodeCache from "node-cache";

export const cache = new NodeCache({
  stdTTL: 60, // cache de 60 segundos
  checkperiod: 120
});