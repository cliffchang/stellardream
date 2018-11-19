import weightedChoice from "./weightedChoice";
import gaussian from "gaussian";

function normalizedToRange(min: number, max: number, val: number): number {
  return min + (max - min) * val;
}

/* STARS */

export enum StarType {
  /* Planets in HZ will be tidally locked very quickly, but about half of
     all M dwarfs will have a planet in the HZ
   */
  M = "M",
  /* Starting to look good. Kepler searches star types K-F.
   */
  K = "K",
  G = "G", // the sun is a G2
  F = "F",
  /* Stars age too quickly - only support life for about 2 billion years. Life may
     be microbial, but likely no trees.
   */
  A = "A",
  B = "B",
  /*
  Planetary dust disks located within 1.6 light-years of O-type stars are
  likely to be "boiled off" by superhot radiation and winds
  (therefore O-type stars likely won't have planets)
  */
  O = "O"  
}

// http://lup.lub.lu.se/luur/download?func=downloadFile&recordOId=8867455&fileOId=8870454
export const StarTypeProbabilities = new Map<StarType, number>([
  [StarType.M, 0.7645629],
  [StarType.K, 0.1213592],
  [StarType.G, 0.0764563],
  [StarType.F, 0.0303398],
  [StarType.A, 0.0060679],
  [StarType.B, 0.0012136],
  [StarType.O, 0.0000003],
]);

export const StarTemperature = new Map<StarType, number>([
  [StarType.M, 3850],
  [StarType.K, 5300],
  [StarType.G, 5920],
  [StarType.F, 7240],
  [StarType.A, 9500],
  [StarType.B, 31000],
  [StarType.O, 41000],
]);

export const StarLuminosityMin = new Map<StarType, number>([
  [StarType.M, 0.000158],
  [StarType.K, 0.086],
  [StarType.G, 0.58],
  [StarType.F, 1.54],
  [StarType.A, 4.42],
  [StarType.B, 21.2],
  [StarType.O, 26800],
]);

export const StarLuminosityMax = new Map<StarType, number>([
  [StarType.M, 0.086],
  [StarType.K, 0.58],
  [StarType.G, 1.54],
  [StarType.F, 4.42],
  [StarType.A, 21.2],
  [StarType.B, 26800],
  [StarType.O, 78100000],
]);

export const StarRadiusMin = new Map<StarType, number>([
  [StarType.M, 0.08],
  [StarType.K, 0.7],
  [StarType.G, 0.96],
  [StarType.F, 1.15],
  [StarType.A, 1.4],
  [StarType.B, 1.8],
  [StarType.O, 6.6],
]);

export const StarRadiusMax = new Map<StarType, number>([
  [StarType.M, 0.7],
  [StarType.K, 0.96],
  [StarType.G, 1.15],
  [StarType.F, 1.4],
  [StarType.A, 1.8],
  [StarType.B, 6.6],
  [StarType.O, 12],
]);


// http://www.vendian.org/mncharity/dir3/starcolor/
export const StarColors = new Map<StarType, string>([
  [StarType.O, '#9bb0ff'],
  [StarType.B, '#aabfff'],
  [StarType.A, '#cad7ff'],
  [StarType.F, '#f8f7ff'],
  [StarType.G, '#fff4ea'],
  [StarType.K, '#ffd2a1'],
  [StarType.M, '#ffcc6f'],
]);

// http://www.solstation.com/habitable.htm
/**
* ~44% of F6-K3 stars with 0.5-1.5 stellar masses are likely binary/multiple star systems,
* making stable orbits extremely unlikely unless the stars are close together.
* 
* Inside HZ: "water is broken up by stellar radiation into oxygen and hydrogen...
* the freed hydrogen would escape to space due to the relatively puny
* gravitational pull of small rocky planets like Earth"
* 
* Outside HZ: "atmospheric carbon dioxide condenses...which eliminates its
* greenhouse warming effect."
* 
* Stars get brighter as they age, so HZ expands outward. CHZ = "continuously habitable zone"
* over time.
*/
export const HabitableZonePlanetLikelihoods = new Map<StarType, number>([
  [StarType.M, 0.0002],
  [StarType.K, 0.001],
  [StarType.G, 0.002],
  [StarType.F, 0.001],
  // my sources don't discuss these star types, and they are rare, so just pick
  // some random small values
  [StarType.A, 0.0002],
  [StarType.B, 0.00015],
  [StarType.O, 0.0001],
]);

// "normalized solar flux factor"
// http://www.solstation.com/habitable.htm
const SeffInner = new Map<StarType, number>([
  [StarType.M, 1.05],
  [StarType.K, 1.05],
  [StarType.G, 1.41],
  [StarType.F, 1.9],
  [StarType.A, 0],
  [StarType.B, 0],
  [StarType.O, 0],
]);

const SeffOuter = new Map<StarType, number>([
  [StarType.M, 0.27],
  [StarType.K, 0.27],
  [StarType.G, 0.36],
  [StarType.F, 0.46],
  [StarType.A, 0],
  [StarType.B, 0],
  [StarType.O, 0],
]);

function computeHabitableZoneHelper(luminosity: number, seff: number): number {
  return 1 * Math.pow(luminosity / seff, 0.5);
}

export function computeHabitableZone(t: StarType, luminosity: number): [number, number] {
  return [
      computeHabitableZoneHelper(luminosity, SeffInner.get(t)!),
      computeHabitableZoneHelper(luminosity, SeffOuter.get(t)!)]
}

export function computeMass(luminosity: number): number {
  // https://en.wikipedia.org/wiki/Mass%E2%80%93luminosity_relation
  // and also 
  // http://lup.lub.lu.se/luur/download?func=downloadFile&recordOId=8867455&fileOId=8870454
  let a = 0.23;
  let b = 2.3;
  if (luminosity > 0.03) {
    a = 1;
    b = 4;
  }
  if (luminosity > 16) {
    a = 1.5;
    b = 3.5;
  }
  if (luminosity > 54) {
    a = 3200;
    b = 1;
  }
  return Math.pow(luminosity / a, b);
}

/*
// this is garbage and wrong, don't use this
// might be able to salvage using this:
// https://www.astro.princeton.edu/~gk/A403/constants.pdf
export function computeRadius(t: StarType, luminosity: number): number {
  const temperature = StarTemperature.get(t)!;
  const tempRatio = temperature / StarTemperature.get(StarType.G)!

  return Math.sqrt(Math.pow(tempRatio, 4) / luminosity);
}
*/

/*
  https://arxiv.org/pdf/1511.07438.pdf
  
  According to this paper, metallicity distribution is best represented
  by a combination of two Gaussians.

  Units are in [Fe/H], which you should google. It's a measure of the
  presence of iron vs the solar system on a logarithmic scale.
*/
export function getMetallicityValue(aRandomNumber: number, n2: number): number {
  const dist1 = gaussian(0.3, 0.1);
  const dist2 = gaussian(-0.45, 0.1);
  const val1 = dist1.ppf(aRandomNumber);
  const val2 = dist2.ppf(aRandomNumber);
  // According to stats.stackexchange.com there's a super mathy way to
  // combine two Gaussian distributions, but using a weighted choice
  // seems to produce similar results, so whatever.
  return weightedChoice([[val1, 1.5], [val2, 0.5]], n2);
}

export class Star {
    starType: StarType;
    luminosity: number;
    mass: number;
    radius: number;
    color: string;
    metallicity: number;

    // _metallicity?: number;
    // _metallicityValues: [number, number];

    constructor(getRandom: any) {
        let weights = Array<[StarType, number]>();
        StarTypeProbabilities.forEach((v: number, k: StarType) => {
          weights.push([k, v]);
        });
        this.starType = weightedChoice(weights, getRandom());
        this.color = StarColors.get(this.starType)!;

        const sizeValue = getRandom();
        this.luminosity = normalizedToRange(
          StarLuminosityMin.get(this.starType)!,
          StarLuminosityMax.get(this.starType)!,
          sizeValue);
        this.radius = normalizedToRange(
          StarRadiusMin.get(this.starType)!,
          StarRadiusMax.get(this.starType)!,
          sizeValue);
        this.mass = computeMass(this.luminosity);

        // this._metallicity = undefined;
        // this._metallicityValues = [getRandom(), getRandom()];
        this.metallicity = getMetallicityValue(getRandom(), getRandom());
    }

    // get metallicity(): number {
    //   // this is expensive, so compute it lazily
    //   if (this._metallicity === null) {
    //     this._metallicity = getMetallicityValue(this._metallicityValues[0], this._metallicityValues[1]);
    //   }
    //   return this._metallicity!;
    // }
}