// UK specialist WOOD / HARDWOOD SUPPLIERS — retail + trade merchants
// specialising in hardwood species (oak, walnut, sapele, ash, etc)
// for woodworking, cabinet-making, and bespoke joinery.
//
// These sit between the wholesale timber importers and the general
// builders' merchants — you go to them when you need specific timber
// species cut-to-size in quantities smaller than a container load.

import type { CompanyEntry } from "./_types";

export const WOOD_SUPPLIERS: CompanyEntry[] = [
  {
    canonical: "British Hardwoods",
    category:  "wood_supplier",
    blurb:     "a UK specialist hardwood timber merchant supplying prime-grade oak, ash, beech, maple, cherry, walnut and other kiln-dried hardwoods to trade and retail",
    patterns:  [/\bbritish\s?hardwoods?\b/i]
  },
  {
    canonical: "iWood Timber Merchants",
    category:  "wood_supplier",
    blurb:     "a UK online timber merchant importing hardwoods from sawmills worldwide — hardwood, softwood, cut-to-size and online-ordered",
    patterns:  [/\biwood\b/i, /\biwood\s?timber\b/i]
  },
  {
    canonical: "Robbins Timber",
    category:  "wood_supplier",
    blurb:     "a Bristol-based UK specialist hardwood timber merchant stocking walnut, oak, sapele, utile and other hardwoods, delivering nationally",
    patterns:  [/\brobbins\s?timber\b/i, /\brobbin(s)?\.co\.uk\b/i]
  },
  {
    canonical: "Timbersource",
    category:  "wood_supplier",
    blurb:     "a UK commercial hardwood timber merchant supplying oak, walnut, ash, sapele and other species cut to size",
    patterns:  [/\btimbersource\b/i]
  },
  {
    canonical: "Hardwood Sales",
    category:  "wood_supplier",
    blurb:     "a Liverpool-based UK independent hardwood specialist importer supplying premium hardwoods (kiln-dried oak, walnut, ash, sapele) to trade professionals",
    patterns:  [/\bhardwood\s?sales?\b/i]
  },
  {
    canonical: "Whitmore's Timber",
    category:  "wood_supplier",
    blurb:     "a UK hardwood timber supplier — trade + retail, kiln-dried hardwoods including English + American oak, walnut, ash",
    patterns:  [/\bwhitmore'?s?\s?timber\b/i]
  },
  {
    canonical: "UK Timber Company",
    category:  "wood_supplier",
    blurb:     "a UK timber merchant supplying European kiln-dried, seasoned + green oak, plus American cherry, ash, maple, walnut, and African species (sapele, iroko, idigbo, teak)",
    patterns:  [/\buk\s?timber\s?company\b/i]
  },
  {
    canonical: "Duffield Timber",
    category:  "wood_supplier",
    blurb:     "a UK timber merchant supplying hardwoods, softwoods and sheet materials to trade and retail",
    patterns:  [/\bduffield\s?timber\b/i]
  },
  {
    canonical: "English Woodlands Timber",
    category:  "wood_supplier",
    blurb:     "a UK specialist supplier of native and European hardwoods including English oak, ash, elm, cherry, walnut",
    patterns:  [/\benglish\s?woodlands?\s?timber\b/i]
  },
  {
    canonical: "Premier Forest Products",
    category:  "wood_supplier",
    blurb:     "a UK hardwood + softwood timber supplier with in-house machining and bespoke moulding capability",
    patterns:  [/\bpremier\s?forest\b/i]
  },
  {
    canonical: "Nottage Timber",
    category:  "wood_supplier",
    blurb:     "a UK timber merchant supplying hardwoods, softwoods, sheet materials and mouldings to trade and DIY",
    patterns:  [/\bnottage\s?timber\b/i]
  }
];
