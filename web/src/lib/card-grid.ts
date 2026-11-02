// Los van place-ui.tsx ("use client"): serverpagina's kunnen deze klassen dan gewoon gebruiken.

/**
 * Raster voor kaarten met layout="stack": op de telefoon een horizontale rij (vaste kaartbreedte, vastklikken aan de
 * zijmarge), vanaf sm een raster van 2 en vanaf lg 3 kolommen. Elke kaart beslaat 5 rijen (subgrid), zodat foto's,
 * vertrekregels, namen en prijzen van kaarten naast elkaar precies op één lijn staan. Zijmarge (-mx/px) zet de pagina.
 */
export const CARD_GRID =
  "no-scrollbar grid snap-x snap-mandatory auto-cols-[min(78vw,22rem)] grid-flow-col gap-x-3 overflow-x-auto pb-2 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-2 sm:gap-y-3 sm:overflow-visible lg:grid-cols-3";
export const CARD_CELL = "row-span-5 grid snap-start grid-rows-subgrid";
