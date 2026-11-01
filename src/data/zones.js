export const zones = [
  {
    id: "centro",
    name: "Centro urbano",
    population: 90,
    access: 95,
    competition: 85,
    services: 95
  },
  {
    id: "residential",
    name: "Zona residencial",
    population: 85,
    access: 75,
    competition: 35,
    services: 65
  },
  {
    id: "developing",
    name: "Zona en desarrollo",
    population: 60,
    access: 55,
    competition: 15,
    services: 40
  }
];

export const businessTypes = {
  cafeteria: {
    name: "Cafetería",
    weights: {
      population: 0.35,
      access: 0.30,
      competition: 0.25,
      services: 0.10
    }
  },
  farmacia: {
    name: "Farmacia",
    weights: {
      population: 0.40,
      access: 0.25,
      competition: 0.10,
      services: 0.25
    }
  },
  supermercado: {
    name: "Supermercado",
    weights: {
      population: 0.40,
      access: 0.25,
      competition: 0.20,
      services: 0.15
    }
  }
};