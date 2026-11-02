// Carreras disponibles en la calculadora de promedio (/promedio).
// Para agregar una carrera: sumar un objeto a CARRERAS con el mismo formato. No hay que tocar nada más.
//
// Cada carrera tiene «bloques» (años, ciclos o grupos de materias). Un bloque con la propiedad `opcional`
// solo se tiene en cuenta cuando la persona lo activa: nunca viene activado de entrada.
// Los id de las materias no deben repetirse dentro de una carrera ni cambiarse una vez publicados,
// porque con ellos se guardan las notas en el navegador.

export const CARRERAS = [
  {
    id: 'medicina-uba',
    etiqueta: 'Medicina (UBA)',
    plan: 'Plan de Estudios 2024 (Res. CS 1217/2023), el que corresponde a quienes cursaron el CBC en 2024 o después.',
    fuente: {
      texto: 'Plan de estudios en el sitio de la Facultad de Medicina',
      url: 'https://www.fmed.uba.ar/carreras/medicina/plan-de-estudios-24-rescs-2023-1217-uba-rec',
    },
    bloques: [
      {
        id: 'cbc',
        titulo: 'CBC',
        descripcion: 'Ciclo Básico Común.',
        opcional: {
          etiqueta: 'Incluir el CBC',
          ayuda: 'Suma las notas del CBC al promedio.',
        },
        materias: [
          { id: 'cbc-ipc', nombre: 'Introducción al Pensamiento Científico (IPC)' },
          { id: 'cbc-icse', nombre: 'Introducción al Conocimiento de la Sociedad y el Estado (ICSE)' },
          { id: 'cbc-matematica', nombre: 'Matemática' },
          { id: 'cbc-quimica', nombre: 'Química' },
          { id: 'cbc-biofisica', nombre: 'Biofísica' },
          { id: 'cbc-biologia', nombre: 'Biología Celular' },
        ],
      },
      {
        id: 'anio1',
        titulo: 'Primer año',
        materias: [
          { id: 'anatomia', nombre: 'Anatomía' },
          { id: 'histologia', nombre: 'Histología' },
          { id: 'embriologia', nombre: 'Embriología' },
          { id: 'biomol-genetica', nombre: 'Biología Molecular y Genética' },
        ],
      },
      {
        id: 'anio2',
        titulo: 'Segundo año',
        materias: [
          { id: 'bioquimica', nombre: 'Bioquímica' },
          { id: 'fisiologia', nombre: 'Fisiología' },
          { id: 'inmunologia', nombre: 'Inmunología' },
          { id: 'microbiologia', nombre: 'Microbiología y Parasitología' },
        ],
      },
      {
        id: 'sin-anio',
        titulo: 'Materias sin año fijo',
        descripcion: 'No se cursan en un año puntual: cada estudiante las hace cuando le corresponde.',
        materias: [
          { id: 'salud-mental', nombre: 'Salud Mental' },
          { id: 'bioetica', nombre: 'Bioética' },
          { id: 'salud-publica', nombre: 'Salud Pública' },
        ],
      },
      {
        id: 'clinico',
        titulo: 'Ciclo clínico',
        descripcion: 'Se muestra sin dividir por año porque la distribución exacta puede variar. Si falta una materia, puede agregarla al final de la página.',
        materias: [
          { id: 'patologia', nombre: 'Patología' },
          { id: 'semiologia', nombre: 'Semiología (Medicina I)' },
          { id: 'farmacologia1', nombre: 'Farmacología I' },
          { id: 'farmacologia2', nombre: 'Farmacología II' },
          { id: 'medicina-interna', nombre: 'Medicina Interna (Medicina II)' },
          { id: 'medicina-legal', nombre: 'Medicina Legal y Deontología Médica' },
          { id: 'toxicologia', nombre: 'Toxicología' },
          { id: 'dermatologia', nombre: 'Dermatología' },
          { id: 'diagnostico-imagenes', nombre: 'Diagnóstico por Imágenes' },
          { id: 'infectologia', nombre: 'Infectología' },
          { id: 'neumonologia', nombre: 'Neumonología' },
          { id: 'neurologia', nombre: 'Neurología' },
          { id: 'nutricion', nombre: 'Nutrición' },
          { id: 'psiquiatria', nombre: 'Psiquiatría' },
          { id: 'cirugia', nombre: 'Cirugía General' },
          { id: 'ginecologia', nombre: 'Ginecología' },
          { id: 'neurocirugia', nombre: 'Neurocirugía' },
          { id: 'obstetricia', nombre: 'Obstetricia' },
          { id: 'oftalmologia', nombre: 'Oftalmología' },
          { id: 'otorrino', nombre: 'Otorrinolaringología' },
          { id: 'pediatria', nombre: 'Pediatría' },
          { id: 'traumatologia', nombre: 'Traumatología y Ortopedia' },
          { id: 'urologia', nombre: 'Urología' },
        ],
      },
      {
        id: 'ingles',
        titulo: 'Curso de inglés',
        opcional: {
          etiqueta: 'Incluir el curso de inglés',
          ayuda: 'Suma la nota del curso al promedio.',
        },
        materias: [{ id: 'ingles', nombre: 'Curso de Inglés' }],
      },
    ],
  },
];
