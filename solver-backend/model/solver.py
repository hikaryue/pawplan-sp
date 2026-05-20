from pulp import *
import math

def calculate_me(bw_actual, age, activity_class, pet_class):
    if pet_class == "dog":
        if age == "adult_maintenance_dogs":
            if activity_class == "active_laboratory_kennel_dogs": return 130 * bw_actual ** 0.75
            elif activity_class == "young_adult_laboratory_active_pet_dogs": return 140 * bw_actual ** 0.75
            elif activity_class == "adult_laboratory_active_great_dane_pet_dogs": return 200 * bw_actual ** 0.75
            elif activity_class == "adult_laboratory_active_terrier_pet_dogs": return 180 * bw_actual ** 0.75
            elif activity_class == "inactive_pet_dogs": return 95 * bw_actual ** 0.75
            else: return 105 * bw_actual ** 0.75
        return 120
    else:  #`cat
        if age == "adult_maintenance_cats":
            if activity_class == "domestic_lean": return 100 * bw_actual ** 0.67
            elif activity_class == "domestic_overweight": return 130 * bw_actual ** 0.4
        return 100 * bw_actual ** 0.67 


def build_problem(pet_class, age, foods, food_data, reqs, me_required, weight=None):
    prob = LpProblem("Meal_Plan", LpMinimize)
    x = LpVariable.dicts("food", foods, lowBound=0.05)
    prob += lpSum(x[f] for f in foods)

    total_energy = lpSum(food_data[f]["energy"] * x[f] for f in foods)
    prob += total_energy >= 0.9 * me_required, "Energy_lower"
    prob += total_energy <= 1.1 * me_required, "Energy_upper"

    nutrient_bounds = {}

    for nutrient, levels in reqs[pet_class][age].items():
        ra = levels.get("RA")
        sul = levels.get("SUL")

        if not ra:
            if sul is not None:
                total_nutrient = lpSum(food_data[f].get(nutrient, 0) * x[f] for f in foods)
                limit = (sul * me_required) / 1000
                prob += total_nutrient <= limit, f"{nutrient}_upper"
                nutrient_bounds[nutrient] = {"needed": 0, "limit": limit}
            continue

        total_nutrient = lpSum(food_data[f].get(nutrient, 0) * x[f] for f in foods)

        needed = (ra * me_required) / 1000
        prob += total_nutrient >= needed, f"{nutrient}_lower"
        nutrient_bounds[nutrient] = {"needed": needed}

        if sul is not None:
            limit = (sul * me_required) / 1000
            prob += total_nutrient <= limit, f"{nutrient}_upper"
            nutrient_bounds[nutrient]["limit"] = limit

    #Special constraints

    #Dynamic arginine – adult dogs
    if pet_class == "dog" and age == "adult_maintenance_dogs" and "Arginine" in nutrient_bounds:
        cp_threshold = 100
        total_cp = lpSum(food_data[f].get("Crude_Protein", 0) * x[f] for f in foods)
        s_dog = LpVariable("arginine_cp_slack_dog", lowBound=0)
        prob += s_dog >= total_cp - cp_threshold
        base_arginine = nutrient_bounds["Arginine"]["needed"]
        total_arginine = lpSum(food_data[f].get("Arginine", 0) * x[f] for f in foods)
        prob += total_arginine >= base_arginine + 0.01 * s_dog, "Arg_dynamic_dog"

    #Dynamic arginine – adult cats
    if pet_class == "cat" and age == "adult_maintenance_cats" and "Arginine" in nutrient_bounds:
        cp_threshold = 200
        total_cp = lpSum(food_data[f].get("Crude_Protein", 0) * x[f] for f in foods)
        s_cat = LpVariable("arginine_cp_slack_cat", lowBound=0)
        prob += s_cat >= total_cp - cp_threshold
        base_arginine = nutrient_bounds["Arginine"]["needed"]
        total_arginine = lpSum(food_data[f].get("Arginine", 0) * x[f] for f in foods)
        prob += total_arginine >= base_arginine + 0.02 * s_cat, "Arg_dynamic_cat"

    return prob, x, total_energy, nutrient_bounds


def solver(pet_class, activity_class, age, foods, weight, food_data, reqs):
    me_required = calculate_me(weight, age, activity_class, pet_class)

    prob, x, total_energy, nutrient_bounds = build_problem(
        pet_class, age, foods, food_data, reqs, me_required,
        weight=weight
    )

    prob.solve(PULP_CBC_CMD(msg=False))
    solve_status = LpStatus[prob.status]

    #Compute delivered values
    delivered_me = sum(food_data[f]["energy"] * max(x[f].varValue or 0, 0) for f in foods)

    #Compute total grams
    total_grams = round(
        sum(max(x[f].varValue or 0, 0) * food_data[f].get("grams", 100) for f in foods), 2
    )

    #For debugging infeasibility details
    infeasibility_details = {"under": {}, "over": {}}
    nutrient_summary = {}

    for nutrient, bounds in nutrient_bounds.items():
        total_val = sum(food_data[f].get(nutrient, 0) * max(x[f].varValue or 0, 0) for f in foods)

        nutrient_req = reqs[pet_class][age].get(nutrient, {})
        ra = nutrient_req.get("RA")
        sul = nutrient_req.get("SUL")

        entry = {
            "delivered": round(total_val, 4),
            "status": "ok",
        }

        if ra:
            needed = round(bounds["needed"], 4)
            lower_bound = round(needed * 0.95, 4)
            upper_bound = round(needed * 1.05, 4)
            entry.update({
                "required": needed,
                "lower_bound": lower_bound,
                "upper_bound": upper_bound,
            })
            if total_val < lower_bound:
                entry["status"] = "under"
                infeasibility_details["under"][nutrient] = entry.copy()

        if sul is not None and "limit" in bounds:
            limit = round(bounds["limit"], 4)
            limit_lower = round(limit * 0.95, 4)
            limit_upper = round(limit * 1.05, 4)
            entry.update({
                "limit": limit,
                "limit_lower": limit_lower,
                "limit_upper": limit_upper,
            })
            if total_val > limit_upper:
                entry["status"] = "over"
                infeasibility_details["over"][nutrient] = entry.copy()

        nutrient_summary[nutrient] = entry

    #Post-solve: Vegetable Ratio check (≤ 55% for dogs, ≤ 40% for cats)
    VEGGIE_LIMIT = 0.55 if pet_class == "dog" else 0.40
    veggie_foods = [f for f in foods if food_data[f].get("category") == "vegetables"]
    total_qty_val    = sum(max(x[f].varValue or 0, 0) for f in foods)
    total_veggie_val = sum(max(x[f].varValue or 0, 0) for f in veggie_foods)
    veggie_share = round(total_veggie_val / total_qty_val, 4) if total_qty_val > 0 else 0.0
    veggie_over_limit = veggie_share > VEGGIE_LIMIT
    veggie_entry = {
        "delivered_pct": round(veggie_share * 100, 2),
        "limit_pct": round(VEGGIE_LIMIT * 100, 1),
        "status": "over" if veggie_over_limit else "ok",
    }
    nutrient_summary["_vegetable_share"] = veggie_entry
    if veggie_over_limit:
        infeasibility_details["over"]["_vegetable_share"] = veggie_entry

    #Energy status classification
    no_serious_violations = (
        len(infeasibility_details["under"]) == 0
        and len(infeasibility_details["over"]) == 0
    )

    if veggie_over_limit:
        energy_status = "infeasible"
    elif solve_status == "Optimal":
        energy_status = "optimal"
    else:
        accept_lower = 0.90 * me_required
        accept_upper = 1.10 * me_required

        forgiving_lower = delivered_me * 0.95
        forgiving_upper = delivered_me * 1.05

        in_accept_band = accept_lower <= delivered_me <= accept_upper
        close_to_delivered = forgiving_lower <= me_required <= forgiving_upper

        if (in_accept_band or close_to_delivered) and no_serious_violations and delivered_me > 0:
            energy_status = "optimal_relaxed"
        elif no_serious_violations and delivered_me > 0:
            energy_status = "marginal_relaxed"
        else:
            energy_status = solve_status.lower()

    return (
        prob,
        x,
        me_required,
        delivered_me,
        total_grams,
        energy_status,
        infeasibility_details,
        nutrient_summary,
        {k: v for k, v in food_data.items() if k.startswith("custom_food")}
    )