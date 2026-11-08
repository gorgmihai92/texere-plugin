// Sursele ghidurilor de scriere ale lui Texere („Getting started in philosophy” / „Primii pași în filosofie”):
// note de literatură care vin cu vault-ul și stau lângă ghiduri (Support/Texere/Guides/Writing guide sources), nu printre sursele tale.
// Le recunoaștem după citekey (id), nu după nume sau loc: le poți redenumi sau muta.
const GUIDE_SOURCES = [
  "american_university_academic_support_center_writing_lab_thesis_2009", "anon_how_nd", "blattner_tips_nd", "cartaya_how_nd",
  "horban_writing_1993", "huemer_guide_nd", "jones_how_nd", "mendelovici_sample_2010", "millgram_writing_2024",
  "pryor_guidelines_2012", "rippon_brief_2008", "roberts_7_nd", "tooley_writing_nd", "yablo_guidelines_nd",
];
const GUIDE_SOURCES_DIR = "Writing guide references";
// sursele-exemplu din vault (ca să vezi cum arată o notă de literatură): nu intră în ce „ai de făcut” (Distilează)
const EXAMPLE_SOURCES = ["blackburn_gandeste_2009", "craig_philosophy_2002", "dummett_origins_1996", "verbeek_what_2005", "vica_avatarobots_2026", "descartes_meditations_2022", "mill_utilitarianism_2022", "locke_second_2022"];
const GUIDE_NOTE = /^(Getting started in philosophy|Primii pași în filosofie)\b/;
module.exports = { GUIDE_SOURCES, GUIDE_SOURCES_DIR, GUIDE_NOTE, EXAMPLE_SOURCES };
