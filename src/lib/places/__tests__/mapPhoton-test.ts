/// <reference types="jest" />
import {
  joinParts,
  mapPhotonFeature,
  mapPhotonResponse,
  type PhotonFeature,
} from "../mapPhoton";

const feature = (
  properties: PhotonFeature["properties"],
  coordinates: unknown = [-0.187, 5.6037],
): PhotonFeature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates },
  properties,
});

// Recorded from the live server:
// GET https://photon.komoot.io/api/?q=University%20Avenue%20Accra&limit=3&lat=5.6037&lon=-0.187&lang=en
const LIVE_RESPONSE = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        osm_type: "W",
        osm_id: 204828062,
        osm_key: "amenity",
        osm_value: "university",
        type: "house",
        name: "Accra Technical University",
        street: "Barnes Avenue",
        district: "West Ridge",
        city: "Accra",
        county: "Korle-Klottey Municipal District",
        state: "Greater Accra Region",
        country: "Ghana",
        countrycode: "GH",
        extent: [-0.2081832, 5.5557948, -0.204563, 5.5517678],
      },
      geometry: { type: "Point", coordinates: [-0.2058498, 5.5538187] },
    },
    {
      type: "Feature",
      properties: {
        osm_type: "W",
        osm_id: 315869534,
        osm_key: "highway",
        osm_value: "tertiary",
        type: "street",
        name: "University Avenue",
        county: "Kpone-Katamanso Municipal District",
        state: "Greater Accra Region",
        country: "Ghana",
        countrycode: "GH",
        extent: [-0.1232777, 5.7189563, -0.1204164, 5.7035454],
      },
      geometry: { type: "Point", coordinates: [-0.1223785, 5.7112394] },
    },
    {
      type: "Feature",
      properties: {
        osm_type: "N",
        osm_id: 5030249496,
        osm_key: "highway",
        osm_value: "bus_stop",
        type: "house",
        name: "Accra Technical University",
        street: "Barnes Avenue",
        district: "Tudu",
        city: "Accra",
        county: "Korle-Klottey Municipal District",
        state: "Greater Accra Region",
        country: "Ghana",
        countrycode: "GH",
      },
      geometry: { type: "Point", coordinates: [-0.2054038, 5.5554124] },
    },
  ],
};

describe("joinParts", () => {
  test("trims, drops blanks and de-dupes case-insensitively", () => {
    expect(joinParts([" Accra ", "", null, undefined, "accra", "Ghana"])).toBe(
      "Accra, Ghana",
    );
  });
});

describe("mapPhotonFeature", () => {
  test("street feature (live University Avenue)", () => {
    const s = mapPhotonFeature(LIVE_RESPONSE.features[1] as PhotonFeature);
    expect(s).toEqual({
      id: "photon:W315869534",
      title: "University Avenue",
      subtitle: "Kpone-Katamanso Municipal District, Greater Accra Region, Ghana",
      fullAddress:
        "University Avenue, Kpone-Katamanso Municipal District, Greater Accra Region, Ghana",
      lat: 5.7112394,
      lng: -0.1223785,
    });
  });

  test("POI with street, district and city", () => {
    const s = mapPhotonFeature(LIVE_RESPONSE.features[0] as PhotonFeature);
    expect(s?.title).toBe("Accra Technical University");
    expect(s?.subtitle).toBe("Barnes Avenue, West Ridge, Accra, Greater Accra Region, Ghana");
  });

  test("house without a name uses street + housenumber as the title", () => {
    const s = mapPhotonFeature(
      feature({ type: "house", street: "Barnes Avenue", housenumber: "12", city: "Accra" }),
    );
    expect(s?.title).toBe("Barnes Avenue 12");
    expect(s?.subtitle).toBe("Accra");
  });

  test("street without a housenumber", () => {
    const s = mapPhotonFeature(feature({ street: "Ring Road", city: "Accra" }));
    expect(s?.title).toBe("Ring Road");
    expect(s?.subtitle).toBe("Accra");
  });

  test("city feature does not repeat the city in the subtitle", () => {
    const s = mapPhotonFeature(
      feature({ type: "city", name: "Accra", city: "Accra", state: "Greater Accra Region", country: "Ghana" }),
    );
    expect(s?.title).toBe("Accra");
    expect(s?.subtitle).toBe("Greater Accra Region, Ghana");
    expect(s?.fullAddress).toBe("Accra, Greater Accra Region, Ghana");
  });

  test("repeated parts are de-duped case-insensitively", () => {
    const s = mapPhotonFeature(
      feature({ name: "Legon Hall", district: "Kumasi", city: "kumasi", state: "KUMASI", country: "Ghana" }),
    );
    expect(s?.subtitle).toBe("Kumasi, Ghana");
  });

  test("falls back to county when there is no city", () => {
    const s = mapPhotonFeature(feature({ name: "X", county: "Ga East", country: "Ghana" }));
    expect(s?.subtitle).toBe("Ga East, Ghana");
  });

  test("title falls back to district when there is no name or street", () => {
    const s = mapPhotonFeature(feature({ district: "Legon", city: "Accra" }));
    expect(s?.title).toBe("Legon");
    expect(s?.subtitle).toBe("Accra");
  });

  test("missing properties -> null (no usable title)", () => {
    expect(mapPhotonFeature(feature(undefined))).toBeNull();
    expect(mapPhotonFeature(feature({}))).toBeNull();
  });

  test("missing geometry / coordinates -> null", () => {
    expect(mapPhotonFeature({ properties: { name: "X" } })).toBeNull();
    expect(mapPhotonFeature({ geometry: {}, properties: { name: "X" } })).toBeNull();
  });

  test.each([
    ["null", null],
    ["not an array", "x"],
    ["too short", [1]],
    ["non-numeric", ["a", "b"]],
    ["NaN", [Number.NaN, 5]],
    ["lat out of range", [0, 95]],
    ["lng out of range", [200, 5]],
  ])("invalid coordinates (%s) -> null", (_label, coords) => {
    expect(mapPhotonFeature(feature({ name: "X" }, coords))).toBeNull();
  });

  test("coordinates are [lon, lat]", () => {
    const s = mapPhotonFeature(feature({ name: "X" }, [-0.1, 5.2]));
    expect(s?.lat).toBe(5.2);
    expect(s?.lng).toBe(-0.1);
  });

  test("missing osm ids -> coordinate id", () => {
    const s = mapPhotonFeature(feature({ name: "X" }, [-0.187, 5.6037]));
    expect(s?.id).toBe("photon:5.60370,-0.18700");
  });
});

describe("mapPhotonResponse", () => {
  test.each([[null], [undefined], ["x"], [{}], [{ features: "x" }]])(
    "%p -> []",
    (json) => {
      expect(mapPhotonResponse(json)).toEqual([]);
    },
  );

  test("drops unusable features and de-dupes by id and text", () => {
    const a = feature({ osm_type: "N", osm_id: 1, name: "A", city: "Accra" });
    const sameId = feature({ osm_type: "N", osm_id: 1, name: "A2" });
    const sameText = feature({ osm_type: "N", osm_id: 2, name: "a", city: "accra" }, [0, 0]);
    const bad = feature({ name: "B" }, null);
    const out = mapPhotonResponse({ features: [a, sameId, sameText, bad, 5] });
    expect(out.map((s) => s.id)).toEqual(["photon:N1"]);
  });

  test("maps a recorded live response", () => {
    const out = mapPhotonResponse(LIVE_RESPONSE);
    expect(out).toHaveLength(3);
    expect(out.map((s) => s.title)).toEqual([
      "Accra Technical University",
      "University Avenue",
      "Accra Technical University",
    ]);
    expect(out[2].subtitle).toBe("Barnes Avenue, Tudu, Accra, Greater Accra Region, Ghana");
  });
});
