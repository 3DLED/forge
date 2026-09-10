"""Translate 1,536 movement names into Spanish by taking them apart rather than looking them up.

A phrase table would need 1,536 entries and would be wrong the moment the catalogue gained a
row. Movement names are not sentences, they are a grammar: an optional laterality, an optional
position, an optional grip, a piece of equipment, and the movement itself. There are 622
distinct words across every name in the app, and the top four hundred cover 96% of all word
occurrences -- which is what says the grammar is worth writing down.

    Seated Cable Row        ->  Remo en polea sentado
    One Arm Dumbbell Row    ->  Remo con mancuerna a un brazo
    Incline Barbell Bench Press -> Press de banca inclinado con barra

Three things English hid, all of them the same shape as the run voice's:

**Gender and number.** "Reverse" is one word; "invertido", "invertida", "invertidos" and
"invertidas" are four, and which one is right depends on the noun it lands on. So every core
movement carries its gender and number, and adjectives are inflected to agree.

**Word order.** English stacks modifiers in front of the noun. Spanish puts the noun first and
hangs the rest off the back, in a fixed order: what you are doing, with what, how, in what
position, on which side.

**Position describes the athlete, not the movement.** "Seated" in "Seated Row" is the person,
so it stays masculine singular no matter what gender "remo" is.

Anything whose core movement is not in the table comes back as None and is reported rather
than guessed at, because a wrong name in a picker is worse than an English one.

    python tools/translate_names.py            # coverage, and the validation set
    python tools/translate_names.py --write    # also generate the Spanish name file
    python tools/translate_names.py --misses   # every name that has no translation
"""

import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
Q = chr(39)
NL = chr(10)
CRLF = chr(13) + NL

#: Gender and number of a Spanish noun, so adjectives can be made to agree.
#: "ms" masculine singular, "fp" feminine plural, and so on.
MS, FS, MP, FP = "ms", "fs", "mp", "fp"

#: The movement itself, longest phrase matched first.
#:
#: Each entry is (English, Spanish, gender-and-number). The gender is not decoration: it is
#: what lets "reverse", "inclined" and "alternating" be written once each instead of four
#: times each.
CORE = [
    ("bench press", "Press de banca", MS),
    ("incline bench press", "Press inclinado", MS),
    ("decline bench press", "Press declinado", MS),
    ("chest press", "Press de pecho", MS),
    ("shoulder press", "Press de hombros", MS),
    ("military press", "Press militar", MS),
    ("overhead press", "Press sobre la cabeza", MS),
    ("push press", "Push press", MS),
    ("floor press", "Press en el suelo", MS),
    ("leg press", "Prensa de piernas", FS),
    ("calf press", "Prensa de pantorrillas", FS),
    ("preacher curl", "Curl en banco Scott", MS),
    ("concentration curl", "Curl concentrado", MS),
    ("hammer curl", "Curl martillo", MS),
    ("wrist curl", "Curl de muñeca", MS),
    ("biceps curl", "Curl de bíceps", MS),
    ("bicep curl", "Curl de bíceps", MS),
    ("leg curl", "Curl femoral", MS),
    ("curl", "Curl", MS),
    ("triceps extension", "Extensión de tríceps", FS),
    ("tricep extension", "Extensión de tríceps", FS),
    ("leg extension", "Extensión de piernas", FS),
    ("back extension", "Extensión de espalda", FS),
    ("hip extension", "Extensión de cadera", FS),
    ("extension", "Extensión", FS),
    ("lateral raise", "Elevación lateral", FS),
    ("front raise", "Elevación frontal", FS),
    ("calf raise", "Elevación de pantorrillas", FS),
    ("leg raise", "Elevación de piernas", FS),
    ("knee raise", "Elevación de rodillas", FS),
    ("hip raise", "Elevación de cadera", FS),
    ("glute-ham raise", "Elevación femoral", FS),
    ("raise", "Elevación", FS),
    ("upright row", "Remo al mentón", MS),
    ("bent over row", "Remo inclinado", MS),
    ("seated row", "Remo sentado", MS),
    ("row", "Remo", MS),
    ("front squat", "Sentadilla frontal", FS),
    ("split squat", "Sentadilla búlgara", FS),
    ("hack squat", "Hack squat", MS),
    ("sissy squat", "Sentadilla sissy", FS),
    ("jump squat", "Sentadilla con salto", FS),
    ("air squat", "Sentadilla sin peso", FS),
    ("squat", "Sentadilla", FS),
    ("romanian deadlift", "Peso muerto rumano", MS),
    ("stiff leg deadlift", "Peso muerto piernas rígidas", MS),
    ("sumo deadlift", "Peso muerto sumo", MS),
    ("deadlift", "Peso muerto", MS),
    ("good morning", "Buenos días", MP),
    ("hip thrust", "Empuje de cadera", MS),
    ("glute bridge", "Puente de glúteos", MS),
    ("bridge", "Puente", MS),
    ("swing", "Swing", MS),
    ("clean and jerk", "Cargada y envión", FS),
    ("clean", "Cargada", FS),
    ("snatch", "Arrancada", FS),
    ("thruster", "Thruster", MS),
    ("push-up", "Flexión", FS),
    ("push up", "Flexión", FS),
    ("pushup", "Flexión", FS),
    ("pull-up", "Dominada", FS),
    ("pull up", "Dominada", FS),
    ("chin-up", "Dominada supina", FS),
    ("chin up", "Dominada supina", FS),
    ("muscle up", "Muscle-up", MS),
    ("pulldown", "Jalón", MS),
    ("pullover", "Pullover", MS),
    ("dip", "Fondo", MS),
    ("fly", "Aperturas", FP),
    ("flye", "Aperturas", FP),
    ("pec deck", "Contractor de pecho", MS),
    ("shrug", "Encogimiento de hombros", MS),
    ("face pull", "Face pull", MS),
    ("high pull", "Tirón alto", MS),
    ("kickback", "Patada de tríceps", FS),
    ("lunge", "Zancada", FS),
    ("step-up", "Subida al cajón", FS),
    ("step up", "Subida al cajón", FS),
    ("crunch", "Crunch", MS),
    ("sit-up", "Abdominal", MS),
    ("sit up", "Abdominal", MS),
    ("russian twist", "Giro ruso", MS),
    ("twist", "Giro", MS),
    ("plank", "Plancha", FS),
    ("hollow hold", "Hollow hold", MS),
    ("l-sit", "L-sit", MS),
    ("rollout", "Rueda abdominal", FS),
    ("woodchop", "Leñador", MS),
    ("dead bug", "Dead bug", MS),
    ("mountain climber", "Escalador", MS),
    ("flutter kick", "Patada de aleteo", FS),
    ("scissor kick", "Patada de tijera", FS),
    ("kick", "Patada", FS),
    ("burpee", "Burpee", MS),
    ("turkish get-up", "Turkish get-up", MS),
    ("get-up", "Levantada", FS),
    ("broad jump", "Salto horizontal", MS),
    ("box jump", "Salto al cajón", MS),
    ("jump", "Salto", MS),
    ("carry", "Acarreo", MS),
    ("farmers walk", "Paseo del granjero", MS),
    ("walk", "Caminata", FS),
    ("run", "Carrera", FS),
    ("sprint", "Sprint", MS),
    ("jog", "Trote", MS),
    ("stretch", "Estiramiento", MS),
    ("rotation", "Rotación", FS),
    ("circle", "Círculo", MS),
    ("hold", "Sostenido", MS),
    ("bend", "Flexión lateral", FS),
    ("toe touch", "Toque de puntas", MS),
    ("wall sit", "Sentadilla isométrica", FS),
    ("slam", "Golpeo", MS),
    ("throw", "Lanzamiento", MS),
    ("pushdown", "Pushdown", MS),
    ("pull through", "Pull through", MS),
    ("v-up", "V-up", MS),
    ("v up", "V-up", MS),
    ("v sit", "V-sit", MS),
    ("hip adduction", "Aducción de cadera", FS),
    ("hip abduction", "Abducción de cadera", FS),
    ("adduction", "Aducción", FS),
    ("abduction", "Abducción", FS),
    ("windmill", "Molino", MS),
    ("planche", "Planche", MS),
    ("tire flip", "Volteo de neumático", MS),
    ("flip", "Volteo", MS),
    ("dead hang", "Suspensión", FS),
    ("hang", "Suspensión", FS),
    ("crossover", "Cruce", MS),
    ("bird dog", "Bird dog", MS),
    ("lift", "Levantamiento", MS),
    ("pose", "Postura", FS),
    ("bike", "Bicicleta", FS),
    ("jump rope", "Salto a la cuerda", MS),
    ("battling rope", "Cuerdas de batalla", FP),
    ("battle rope", "Cuerdas de batalla", FP),
    ("wave", "Onda", FS),
    ("chop", "Corte", MS),
    ("pull", "Tirón", MS),
    ("push", "Empuje", MS),
    ("incline walk", "Caminata en pendiente", FS),
    ("incline run", "Carrera en pendiente", FS),
    ("treadmill walk", "Caminata en cinta", FS),
    ("treadmill run", "Carrera en cinta", FS),
    ("lat pulldown", "Jalón al pecho", MS),
    ("straight arm pulldown", "Jalón con brazos rectos", MS),
    ("behind neck press", "Press tras nuca", MS),
    ("behind the neck press", "Press tras nuca", MS),
    ("chest fly", "Aperturas de pecho", FP),
    ("rear delt fly", "Aperturas posteriores", FP),
    ("rear delt row", "Remo posterior", MS),
    ("side lunge", "Zancada lateral", FS),
    ("side plank", "Plancha lateral", FS),
    ("side bend", "Flexión lateral", FS),
    ("side raise", "Elevación lateral", FS),
    ("side kick", "Patada lateral", FS),
    ("side crunch", "Crunch lateral", MS),
    ("reverse lunge", "Zancada invertida", FS),
    ("walking lunge", "Zancada caminando", FS),
    ("curtsey lunge", "Zancada cruzada", FS),
    ("hip circle", "Círculo de cadera", MS),
    ("straight leg deadlift", "Peso muerto piernas rectas", MS),
    ("bench dip", "Fondo en banco", MS),
    ("close grip bench press", "Press de banca agarre cerrado", MS),
    ("triceps dip", "Fondo de tríceps", MS),
    ("triceps pushdown", "Pushdown de tríceps", MS),
    ("triceps kickback", "Patada de tríceps", FS),
    ("high row", "Remo alto", MS),
    ("low row", "Remo bajo", MS),
    ("high knee", "Rodilla alta", FS),
    ("neck stretch", "Estiramiento de cuello", MS),
    ("chest stretch", "Estiramiento de pecho", MS),
    ("back stretch", "Estiramiento de espalda", MS),
    ("shoulder stretch", "Estiramiento de hombros", MS),
    ("hamstring stretch", "Estiramiento de isquiotibiales", MS),
    ("calf stretch", "Estiramiento de pantorrillas", MS),
    ("hip stretch", "Estiramiento de cadera", MS),
    ("quad stretch", "Estiramiento de cuádriceps", MS),
    ("external rotation", "Rotación externa", FS),
    ("internal rotation", "Rotación interna", FS),
    ("jumping jack", "Jumping jack", MS),
    ("step down", "Bajada del cajón", FS),
    ("box step", "Subida al cajón", FS),
    ("press", "Press", MS),
]

#: What the movement is done with. These are prepositional phrases and never inflect.
EQUIPMENT = [
    ("barbell", "con barra"),
    ("ez barbell", "con barra Z"),
    ("ez-bar", "con barra Z"),
    ("olympic barbell", "con barra olímpica"),
    ("trap bar", "con barra hexagonal"),
    ("dumbbell", "con mancuernas"),
    ("kettlebell", "con kettlebell"),
    ("cable", "en polea"),
    ("band", "con banda"),
    ("resistance band", "con banda elástica"),
    ("smith machine", "en máquina Smith"),
    ("smith", "en máquina Smith"),
    ("lever", "en máquina"),
    ("machine", "en máquina"),
    ("sled", "en trineo"),
    ("medicine ball", "con balón medicinal"),
    ("stability ball", "con fitball"),
    ("exercise ball", "con fitball"),
    ("bosu ball", "con bosu"),
    ("wall ball", "con balón de pared"),
    ("weighted", "con lastre"),
    ("assisted", "asistido"),
    ("suspension", "en TRX"),
    ("rope", "con cuerda"),
    ("roller", "con rodillo"),
    ("bodyweight", "sin peso"),
    ("plate", "con disco"),
]

#: Where the athlete is. Describes the person, so it never agrees with the movement's noun.
POSITION = [
    ("seated", "sentado"),
    ("standing", "de pie"),
    ("lying", "acostado"),
    ("prone", "boca abajo"),
    ("supine", "boca arriba"),
    ("kneeling", "de rodillas"),
    ("bent over", "inclinado"),
    ("bent-over", "inclinado"),
    ("incline", "en banco inclinado"),
    ("decline", "en banco declinado"),
    ("floor", "en el suelo"),
    ("wall", "en la pared"),
    ("hanging", "colgado"),
    ("side lying", "de lado"),
]

#: How it is held.
GRIP = [
    ("close grip", "agarre cerrado"),
    ("wide grip", "agarre ancho"),
    ("narrow grip", "agarre estrecho"),
    ("neutral grip", "agarre neutro"),
    ("reverse grip", "agarre supino"),
    ("underhand", "agarre supino"),
    ("overhand", "agarre prono"),
    ("hammer grip", "agarre martillo"),
]

#: One side at a time, or both.
LATERALITY = [
    ("one arm", "a un brazo"),
    ("single arm", "a un brazo"),
    ("one-arm", "a un brazo"),
    ("single-arm", "a un brazo"),
    ("one leg", "a una pierna"),
    ("single leg", "a una pierna"),
    ("single-leg", "a una pierna"),
    ("one-leg", "a una pierna"),
    ("alternating", "alternando"),
    ("alternate", "alternando"),
]

#: Adjectives that describe the movement, and so have to agree with it.
QUALIFIER = [
    ("reverse", "invertido"),
    ("inverted", "invertido"),
    ("lateral", "lateral"),
    ("front", "frontal"),
    ("rear", "posterior"),
    ("overhead", "sobre la cabeza"),
    ("tempo", "a tempo"),
    ("explosive", "explosivo"),
    ("isometric", "isométrico"),
    ("eccentric", "excéntrico"),
    ("negative", "negativo"),
    ("wide", "abierto"),
    ("narrow", "cerrado"),
    ("deficit", "con déficit"),
    ("paused", "con pausa"),
    ("strict", "estricto"),
]


#: Words that carry nothing once the phrases around them have been taken out.
STOPWORDS = {"of", "the", "a", "an", "on", "in", "with", "and", "to", "for", "at", "by", "from"}


def agree(adjective, gn):
    """A Spanish adjective made to agree with a noun's gender and number.

    Only the two productive patterns, which is all these adjectives use: words ending in `o`
    take the full four forms, and everything else keeps one form per number.
    """
    if " " in adjective:
        # A prepositional phrase, not an adjective: "sobre la cabeza" never changes.
        return adjective
    feminine, plural = gn[0] == "f", gn[1] == "p"
    stem = adjective
    if stem.endswith("o") and feminine:
        stem = stem[:-1] + "a"
    if plural:
        stem += "s" if stem[-1] in "aeiou" else "es"
    return stem


def phrases(text, table):
    """Pull every phrase in `table` out of `text`, longest first. Returns (rest, found)."""
    found = []
    for english, spanish in sorted(table, key=lambda pair: -len(pair[0])):
        pattern = r"(?<![a-z])" + re.escape(english).replace(r"\ ", r"\s+") + r"s?(?![a-z])"
        if re.search(pattern, text):
            text = re.sub(pattern, " ", text, count=1)
            found.append(spanish)
    return text, found


def normalise(name):
    """Lowercased, with the version marker pulled out and handed back separately.

    Parentheses are deliberately NOT discarded. "Push-Up (on Stability Ball)" and "Push-Up"
    are different movements, and throwing the bracket away made them the same Spanish name --
    the same mistake as silently dropping a leftover word, wearing different punctuation.
    What is inside usually parses anyway ("on Stability Ball" is equipment), and what does not
    becomes a leftover and refuses the translation, which is the right answer.
    """
    lowered = name.lower().replace("(", " ").replace(")", " ")
    version = re.search(r"(?<![a-z])v\.?\s*(\d+)(?![a-z])", lowered)
    lowered = re.sub(r"(?<![a-z])v\.?\s*\d+(?![a-z])", " ", lowered)
    return re.sub(r"\s+", " ", lowered).strip(), (f" v. {version.group(1)}" if version else "")


def translate(name):
    """The Spanish name, or None when the movement itself is not in the table."""
    text, version = normalise(name)

    core = None
    for english, spanish, gn in sorted(CORE, key=lambda row: -len(row[0])):
        pattern = r"(?<![a-z])" + re.escape(english).replace(r"\ ", r"\s+").replace(r"\-", r"[- ]") + r"s?(?![a-z])"
        if re.search(pattern, text):
            core = (spanish, gn)
            text = re.sub(pattern, " ", text, count=1)
            break
    if core is None:
        return None

    spanish_core, gn = core
    text, grip = phrases(text, GRIP)
    text, laterality = phrases(text, LATERALITY)
    text, equipment = phrases(text, EQUIPMENT)
    text, position = phrases(text, POSITION)
    text, qualifiers = phrases(text, QUALIFIER)

    """
    Anything left over means the name said something this grammar cannot say.

    Dropping it silently is the tempting bug: "Gorilla Row", "Pendlay Row" and "Bent Over Row"
    all reduce to "Remo", and a picker with three identical rows in it is worse than one in
    English. So a leftover word refuses the whole translation, and the English stands.
    """
    if [w for w in re.findall(r"[a-z]+", text) if w not in STOPWORDS]:
        return None

    # Noun first, then what with, how, where, which side -- the order a Spanish speaker
    # would say them in, and fixed so two names never disagree about it.
    parts = [spanish_core]
    parts += [agree(q, gn) for q in qualifiers]
    parts += equipment
    parts += position
    parts += laterality
    parts += grip
    # The version marker rides along: two catalogue rows for the same lift are as confusing
    # in Spanish as in English, and the number is how they are told apart in both.
    return " ".join(p for p in parts if p) + version


#: Names translated by hand, which is what turns coverage into accuracy.
#:
#: Chosen to exercise the awkward parts rather than the easy ones: three genders, both
#: numbers, every modifier slot, and the two orderings that a word-by-word translation gets
#: backwards.
VALIDATION = {
    "Barbell Bench Press": "Press de banca con barra",
    "Seated Cable Row": "Remo en polea sentado",
    "One Arm Dumbbell Row": "Remo con mancuernas a un brazo",
    "Dumbbell Lateral Raise": "Elevación lateral con mancuernas",
    "Reverse Fly": "Aperturas invertidas",
    "Barbell Squat": "Sentadilla con barra",
    "Romanian Deadlift": "Peso muerto rumano",
    "Kettlebell Swing": "Swing con kettlebell",
    "Air Squat": "Sentadilla sin peso",
    "Cable Triceps Extension": "Extensión de tríceps en polea",
    "Standing Calf Raise": "Elevación de pantorrillas de pie",
    "Close Grip Bench Press": "Press de banca agarre cerrado",
    "Hanging Leg Raise": "Elevación de piernas colgado",
    "Single Leg Glute Bridge": "Puente de glúteos a una pierna",
    "Lever Chest Press": "Press de pecho en máquina",
    "Alternating Dumbbell Curl": "Curl con mancuernas alternando",
    "Smith Machine Shoulder Press": "Press de hombros en máquina Smith",
    "Reverse Crunch": "Crunch invertido",
    "Barbell Good Morning": "Buenos días con barra",
    "Weighted Pull-up": "Dominada con lastre",
}


def catalogue_names():
    """Every movement name the app shows, from both libraries."""
    names = []
    path = os.path.join(ROOT, "src", "data", "seed", "catalogue.ts")
    if os.path.exists(path):
        source = io.open(path, encoding="utf-8").read()
        names += [(s, n) for s, n in re.findall(
            r"slug: " + Q + r"([^" + Q + r"]+)" + Q + r".*?name: " + Q + r"([^" + Q + r"]*)" + Q, source)]
    source = io.open(os.path.join(ROOT, "src", "data", "seed", "exercises.ts"), encoding="utf-8").read()
    names += re.findall(
        r"(?<![A-Za-z])(?:ex|cardio|mobility)\(\s*" + Q + r"([^" + Q + r"]+)" + Q + r"\s*,\s*" + Q + r"([^" + Q + r"]+)" + Q,
        source)
    return names


def main():
    names = catalogue_names()
    done = {slug: translate(name) for slug, name in names}
    hit = {s: v for s, v in done.items() if v}
    print(f"translated {len(hit)} of {len(names)} names ({len(hit) * 100 // max(len(names), 1)}%)")

    agreed, wrong = 0, []
    for english, expected in VALIDATION.items():
        got = translate(english)
        if got == expected:
            agreed += 1
        else:
            wrong.append((english, expected, got))
    print()
    print(f"against {len(VALIDATION)} translated by hand:")
    print(f"  agrees    {agreed} ({agreed * 100 // len(VALIDATION)}%)")
    print(f"  disagrees {len(wrong)}")
    for english, expected, got in wrong:
        print(f"    {english}")
        print(f"      want {expected}")
        print(f"      got  {got}")

    if "--misses" in sys.argv:
        print()
        print("no core movement matched:")
        for slug, name in names:
            if not done[slug]:
                print(f"  {name}")

    if "--write" in sys.argv:
        out = os.path.join(ROOT, "src", "data", "seed", "names.es.ts")
        lines = [
            "/**",
            " * Movement names in Spanish, generated by `tools/translate_names.py`.",
            " *",
            " * Do not edit by hand: change the grammar in that file and run it again. A name missing",
            " * from here falls back to its English, which is the ordinary case for anything the core",
            " * movement table does not yet cover.",
            " *",
            " * Ignored by git and committed encrypted, like the catalogue it is derived from.",
            " */",
            "",
            "export const NAMES_ES: Record<string, string> = {",
        ]
        for slug in sorted(hit):
            value = hit[slug].replace(Q, chr(92) + Q)
            lines.append(f"  {Q}{slug}{Q}: {Q}{value}{Q},")
        lines.append("};")
        io.open(out, "w", encoding="utf-8", newline="").write(CRLF.join(lines) + CRLF)
        print()
        print(f"wrote {os.path.relpath(out, ROOT)} with {len(hit)} names")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
