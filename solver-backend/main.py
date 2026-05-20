import json
import asyncio
import os
import glob
import shutil
import tempfile
import uuid
import requests
from itertools import combinations
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from data.foods import FOOD_DATA
from data.nutrients import NUTRIENT_REQUIREMENTS
from model.solver import solver

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)



MIN_FOODS = 2
MAX_FOODS = 7
DISK_REDEPLOY_THRESHOLD_PERCENT = 80

AGE_MAP = {
    "dog": "adult_maintenance_dogs",
    "cat": "adult_maintenance_cats",
}

NUTRIENT_KEYS = [
    "Crude_Protein", "Total_Fat", "Moisture", "Crude_Ash", "Fiber",
    "Arginine", "Histidine", "Isoleucine", "Methionine", "Methionine_Cystine",
    "Leucine", "Lysine", "Phenylalanine", "Phenylalanine_Tyrosine",
    "Threonine", "Tryptophan", "Valine", "Taurine",
    "Linoleic_Acid", "Arachidonic_Acid",
    "Calcium", "Phosphorus", "Magnesium", "Sodium", "Potassium", "Chloride",
    "Iron", "Copper", "Zinc", "Manganese", "Selenium", "Iodine",
    "Vitamins_A", "Cholecalciferol", "Vitamin_E", "Thiamin", "Riboflavin",
    "Pyridoxine", "Niacin", "Pantothenic_Acid", "Cobalamin", "Folic_Acid", "Choline",
]

INPUT_TO_SOLVER = {
    #Macros: % to g/100g
    "Crude_Protein":          { "%": 1 },
    "Total_Fat":              { "%": 1 },
    "Moisture":               { "%": 1 },
    "Crude_Ash":              { "%": 1 },
    "Fiber":                  { "%": 1 },
    #Amino acids: % to g/100g, mg to g/100g
    "Arginine":               { "%": 1, "mg": 1 / 1_000 },
    "Histidine":              { "%": 1, "mg": 1 / 1_000 },
    "Isoleucine":             { "%": 1, "mg": 1 / 1_000 },
    "Methionine":             { "%": 1, "mg": 1 / 1_000 },
    "Methionine_Cystine":     { "%": 1, "mg": 1 / 1_000 },
    "Leucine":                { "%": 1, "mg": 1 / 1_000 },
    "Lysine":                 { "%": 1, "mg": 1 / 1_000 },
    "Phenylalanine":          { "%": 1, "mg": 1 / 1_000 },
    "Phenylalanine_Tyrosine": { "%": 1, "mg": 1 / 1_000 },
    "Threonine":              { "%": 1, "mg": 1 / 1_000 },
    "Tryptophan":             { "%": 1, "mg": 1 / 1_000 },
    "Valine":                 { "%": 1, "mg": 1 / 1_000 },
    "Taurine":                { "%": 1, "mg": 1 / 1_000 },
    #Fatty acids: % or mg to g/100g
    "Linoleic_Acid":          { "%": 1, "mg": 1 / 1_000 },
    "Arachidonic_Acid":       { "%": 1, "mg": 1 / 1_000 },
    #Major minerals: % or mg to g/100g
    "Calcium":                { "%": 1, "mg": 1 / 1_000 },
    "Phosphorus":             { "%": 1, "mg": 1 / 1_000 },
    "Potassium":              { "%": 1, "mg": 1 / 1_000 },

    "Magnesium":              { "mg": 1 },
    "Sodium":                 { "mg": 1 },
    "Chloride":               { "mg": 1 },
    "Iron":                   { "mg": 1 },
    "Copper":                 { "mg": 1 },
    "Zinc":                   { "mg": 1 },
    "Manganese":              { "mg": 1 },
    #trace minerals: mg to µg
    "Selenium":               { "mg": 1_000 },
    "Iodine":                 { "mg": 1_000 },

    "Vitamin_E":              { "mg": 1, "IU": 1 },
    "Thiamin":                { "mg": 1 },
    "Riboflavin":             { "mg": 1 },
    "Pyridoxine":             { "mg": 1 },
    "Niacin":                 { "mg": 1 },
    "Pantothenic_Acid":       { "mg": 1 },
    "Choline":                { "mg": 1 },
    #vitamins: mg to µg
    "Cobalamin":              { "mg": 1_000 },
    "Folic_Acid":             { "mg": 1_000 },
}

#Vitamins A and D3: IU to µg
IU_TO_SOLVER_UG = {
    "Vitamins_A":      0.3,
    "Cholecalciferol": 1 / 40,
}

#Job store: job_id as { status, result, error }
_jobs: dict = {}
_jobs_lock  = Lock()


def _jobs_set(job_id: str, **kwargs):
    with _jobs_lock:
        _jobs[job_id].update(kwargs)


def _jobs_cleanup_finished():
    with _jobs_lock:
        done = [jid for jid, j in _jobs.items() if j["status"] in ("done", "failed")]
        for jid in done[:-20]:
            del _jobs[jid]

def parse_size_to_grams(custom_data: dict) -> float:
    raw_size = custom_data.get("size", 100.0)
    unit = str(custom_data.get("size_unit", "g")).lower().strip()
    size_g = float(raw_size)
    if unit == "kg":
        size_g *= 1000.0
    return size_g


def parse_nutrient_field(raw) -> tuple[float, str]:
    if not isinstance(raw, dict):
        return 0.0, "mg"
    value = raw.get("value", 0)
    unit  = raw.get("unit", "mg")
    return float(value), str(unit).strip()


def nutrient_to_solver_unit(key: str, raw, basis_g: float) -> float:
    value, unit = parse_nutrient_field(raw)

    if key in IU_TO_SOLVER_UG:
        return (value * IU_TO_SOLVER_UG[key] / basis_g) * 100.0

    unit_factors = INPUT_TO_SOLVER.get(key, {})

    if unit not in unit_factors:
        if "%" in unit_factors: unit = "%"
        elif "mg" in unit_factors: unit = "mg"
        elif "IU" in unit_factors: unit = "IU"
        else: return 0.0

    return (value / basis_g) * 100.0 * unit_factors[unit]


def get_disk_usage_percent(path="/") -> float:
    try:
        total, used, free = shutil.disk_usage(path)
        return (used / total) * 100
    except Exception as e:
        print(f"Could not check disk usage: {e}")
        return 0.0


def cleanup_tmp_files():
    tmp     = tempfile.gettempdir()
    deleted = 0
    for pattern in ["*.lp", "*.sol", "*.mps", "*.log"]:
        for f in glob.glob(os.path.join(tmp, pattern)):
            try:
                os.remove(f)
                deleted += 1
            except Exception as e:
                print(f"Could not delete {f}: {e}")
    print(f"Cleanup: deleted {deleted} temp file(s)")


def redeploy_self():
    token = os.getenv("RAILWAY_TOKEN")
    service_id = os.getenv("RAILWAY_SERVICE_ID")
    environment_id = os.getenv("RAILWAY_ENVIRONMENT_ID")

    if not all([token, service_id, environment_id]):
        print("Redeploy skipped: missing env vars")
        return

    query = """
    mutation redeployService($serviceId: String!, $environmentId: String!) {
      serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
    }
    """
    try:
        response = requests.post(
            "https://backboard.railway.app/graphql/v2",
            json={"query": query, "variables": {
                "serviceId":     service_id,
                "environmentId": environment_id,
            }},
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        print(f"Redeploy triggered: {response.status_code} {response.text}")
    except Exception as e:
        print(f"Redeploy failed: {e}")


#ME estimate when energy is not on the label
def custom_energy(moisture, protein, fat, ash, fiber, pet_class):
    nfe = 100 - (moisture + protein + fat + ash + fiber)
    ge  = (5.7 * protein) + (9.4 * fat) + (4.1 * (nfe + fiber))
    if pet_class == "dog":
        digestibility = 91.2 - ((1.43 * fiber * 100) / (100 - moisture))
        me = (ge * (digestibility / 100)) - (1.04 * protein)
    else:
        digestibility = 87.9 - ((0.88 * fiber * 100) / (100 - moisture))
        me = (ge * digestibility / 100) - (0.77 * protein)
    return me


def build_custom_food(custom_data: dict, pet_class: str) -> dict:
    #Nutrients are always stated per 100g on pet food labels
    NUTRIENT_BASIS_G = 100.0

    moisture = nutrient_to_solver_unit("Moisture", custom_data.get("Moisture", 0), NUTRIENT_BASIS_G)
    protein  = nutrient_to_solver_unit("Crude_Protein", custom_data.get("Crude_Protein", 0), NUTRIENT_BASIS_G)
    fat = nutrient_to_solver_unit("Total_Fat", custom_data.get("Total_Fat", 0), NUTRIENT_BASIS_G)
    ash = nutrient_to_solver_unit("Crude_Ash", custom_data.get("Crude_Ash", 0), NUTRIENT_BASIS_G)
    fiber = nutrient_to_solver_unit("Fiber", custom_data.get("Fiber", 0), NUTRIENT_BASIS_G)

    if "energy" in custom_data and custom_data["energy"]:
        energy = float(custom_data["energy"]) / 10.0
    else:
        energy = custom_energy(moisture, protein, fat, ash, fiber, pet_class)

    entry = {
        "grams": 100.0,
        "energy": energy,
        "Crude_Protein": protein,
        "Total_Fat": fat,
        "moisture": moisture,
        "crude_ash": ash,
        "fiber": fiber,
        "_serving_size_g": parse_size_to_grams(custom_data),
        "_serving_unit": str(custom_data.get("size_unit", "g")).lower().strip(),
        "_serving_size_raw": float(custom_data.get("size", 100.0)),
    }

    for key in NUTRIENT_KEYS:
        if key not in entry:
            entry[key] = nutrient_to_solver_unit(key, custom_data.get(key, 0), NUTRIENT_BASIS_G)

    return entry


def compute_servings(solution: dict, food_data: dict) -> dict:
    #Servings = grams needed / serving size; custom foods only
    servings = {}
    for food_key, grams_needed in solution.items():
        food_entry = food_data.get(food_key, {})
        serving_size_g = food_entry.get("_serving_size_g")
        if serving_size_g is None:
            continue
        servings[food_key] = round((grams_needed / serving_size_g) * 100, 2)
    return servings


def solve_combo(args):
    foods, pet_class, activity_class, age, weight, food_data = args
    try:
        prob, x, me, returned_me, total_grams, optimal_me, infeasibility_details, nutrient_summary, custom_foods = solver(
            pet_class, activity_class, age, foods, weight, food_data, NUTRIENT_REQUIREMENTS
        )
        solution = {f: round(max(x[f].varValue or 0, 0), 4) for f in foods}
        return {
            "foods": foods,
            "me": me,
            "returned_me": returned_me,
            "total_grams": total_grams,
            "optimal_me": optimal_me,
            "infeasibility_details":infeasibility_details,
            "nutrient_summary": nutrient_summary,
            "custom_foods": custom_foods,
            "solution": solution,
            "food_data_ref": food_data,
            "error": None,
        }
    except Exception as e:
        return {"foods": foods, "error": str(e)}


def parse_food_list(param: Optional[str]) -> list[str]:
    if not param:
        return []
    return [f.strip() for f in param.split(",") if f.strip()]


def _build_tasks(CLASS, WEIGHT, ACTIVE, CUSTOM, REQUIRED, EXCLUDE):
    #Validate inputs and produce the full task list for the solver
    if CLASS not in AGE_MAP:
        raise ValueError(f"CLASS must be 'dog' or 'cat', got '{CLASS}'")

    age = AGE_MAP[CLASS]
    food_data = dict(FOOD_DATA)

    if CUSTOM:
        try:
            parsed_custom = json.loads(CUSTOM)
        except json.JSONDecodeError:
            raise ValueError("CUSTOM must be valid JSON (object or array of objects)")

        if isinstance(parsed_custom, dict):
            custom_list = [parsed_custom]
        elif isinstance(parsed_custom, list):
            custom_list = parsed_custom
        else:
            raise ValueError("CUSTOM must be a JSON object or array of objects")

        for idx, custom_data in enumerate(custom_list, start=1):
            default_key = f"custom_food_{idx}" if len(custom_list) > 1 else "custom_food"
            key = custom_data.get("name", default_key).strip().replace(" ", "_")
            food_data[key] = build_custom_food(custom_data, CLASS)

    required_foods = parse_food_list(REQUIRED)
    excluded_foods = set(parse_food_list(EXCLUDE))

    missing_required = [f for f in required_foods if f not in food_data]
    if missing_required:
        raise ValueError(f"Required food(s) not found: {', '.join(missing_required)}")

    missing_excluded = [f for f in excluded_foods if f not in food_data]
    if missing_excluded:
        raise ValueError(f"Excluded food(s) not found: {', '.join(missing_excluded)}")

    conflict = [f for f in required_foods if f in excluded_foods]
    if conflict:
        raise ValueError(f"Food(s) cannot be both required and excluded: {', '.join(conflict)}")

    if len(required_foods) > MAX_FOODS:
        raise ValueError(f"Too many required foods. MAX_FOODS is {MAX_FOODS}.")

    optional_foods = [f for f in food_data if f not in required_foods and f not in excluded_foods]
    slots = MAX_FOODS - len(required_foods)
    min_optional = max(0, MIN_FOODS - len(required_foods))

    tasks = [
        (required_foods + list(combo), CLASS, ACTIVE, age, WEIGHT, food_data)
        for r in range(min_optional, slots + 1)
        for combo in combinations(optional_foods, r)
    ]

    return tasks, food_data, age


def _process_results(results) -> dict:
    #Filter solver results to valid unique combinations
    valid_combinations = []
    seen_solutions = set()

    for result in results:
        if result["error"]:
            print(f"Error on combo {result['foods']}: {result['error']}")
            continue

        if result["optimal_me"] not in ("optimal", "optimal_relaxed"):
            continue

        solution_key = frozenset(result["solution"].items())
        if solution_key in seen_solutions:
            continue
        seen_solutions.add(solution_key)

        servings = compute_servings(result["solution"], result["food_data_ref"])

        valid_combinations.append({
            "foods": result["foods"],
            "energy_status": result["optimal_me"],
            "me_required": round(result["me"], 4),
            "delivered_me": round(result["returned_me"], 4),
            "total_grams": result["total_grams"],
            "solution": result["solution"],
            "custom_food_details": result["custom_foods"],
            "servings_needed": servings,
        })

    return {
        "total_valid_combinations": len(valid_combinations),
        "combinations": valid_combinations,
    }


async def _run_job(job_id: str, tasks, food_data):
    _jobs_set(job_id, status="running")
    try:
        loop = asyncio.get_running_loop()
        with ThreadPoolExecutor(max_workers=4) as executor:
            results = await asyncio.gather(*[
                loop.run_in_executor(executor, solve_combo, task)
                for task in tasks
            ])
        _jobs_set(job_id, status="done", result=_process_results(results), error=None)
        _jobs_cleanup_finished()
    except Exception as e:
        _jobs_set(job_id, status="failed", result=None, error=str(e))
        _jobs_cleanup_finished()


#Endpoints
@app.get("/health")
def health():
    usage = get_disk_usage_percent()
    return {"status": "ok", "disk_used_percent": round(usage, 2)}


@app.get("/cleanup")
async def cleanup():
    usage = get_disk_usage_percent()
    print(f"Cleanup called — disk usage: {usage:.1f}%")
    cleanup_tmp_files()
    _jobs_cleanup_finished()

    if usage >= DISK_REDEPLOY_THRESHOLD_PERCENT:
        print(f"Disk at {usage:.1f}% — triggering redeploy.")
        redeploy_self()
        return {
            "status": "redeploying",
            "disk_used_percent": round(usage, 2),
            "reason": f"Disk usage {usage:.1f}% exceeded {DISK_REDEPLOY_THRESHOLD_PERCENT}% threshold.",
        }

    return {"status": "cleaned", "disk_used_percent": round(usage, 2)}


@app.get("/meal-plan-start")
async def meal_plan_start(
    CLASS: str = Query(...),
    WEIGHT: float = Query(...),
    ACTIVE: Optional[str] = Query(None),
    CUSTOM: Optional[str] = Query(None),
    REQUIRED: Optional[str] = Query(None),
    EXCLUDE: Optional[str] = Query(None),
):
    #Start generation in background, return job_id immediately
    try:
        tasks, food_data, _ = _build_tasks(CLASS, WEIGHT, ACTIVE, CUSTOM, REQUIRED, EXCLUDE)
    except ValueError as e:
        return {"error": str(e)}

    job_id = str(uuid.uuid4())
    with _jobs_lock:
        _jobs[job_id] = {"status": "pending", "result": None, "error": None}

    asyncio.create_task(_run_job(job_id, tasks, food_data))

    return {"job_id": job_id}


@app.get("/meal-plan-status/{job_id}")
async def meal_plan_status(job_id: str):
    with _jobs_lock:
        job = _jobs.get(job_id)

    if job is None:
        return {"status": "not_found"}

    if job["status"] in ("done", "failed"):
        result = dict(job)
        with _jobs_lock:
            _jobs.pop(job_id, None)
        return result

    return dict(job)