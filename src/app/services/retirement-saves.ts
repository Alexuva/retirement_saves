import { computed, Injectable, signal, WritableSignal } from '@angular/core';
import { parse } from 'postcss';

export type RetirementData = {
  currentAge: number,
  yearlyIncome: number,
  yearsContributing: number,
  regime: RegimeType,
  annualSalaryIncrease: number,
  annualInflation: number,
  retirementAge: number,
  retirementMonthlyObjective: number,
  currentSaves: number,
  currentSavesMonthly: number,
  currentReturn: number
}

export enum RegimeType {
  AJENA = 'ajena',
  PROPIA = 'propia'
}

@Injectable({
  providedIn: 'root'
})
export class RetirementSaves {

  retirementData: WritableSignal<RetirementData> = signal({
    currentAge: 39,
    yearlyIncome: 29000,
    yearsContributing: 12,
    regime: RegimeType.AJENA,
    annualSalaryIncrease: 4,
    annualInflation: 3,
    retirementAge: 65,
    retirementMonthlyObjective: 3000,
    currentSaves: 10_000,
    currentSavesMonthly: 150,
    currentReturn: 2.5
  })

  retirementResult = computed(() => {

    //1. Get data
    const data = this.retirementData();
    //2. Calculate each salary until retirement
    const salaries = this.projectSalaries(this.retirementData().yearlyIncome, this.retirementData().annualSalaryIncrease, this.retirementData().currentAge, this.retirementData().retirementAge, this.retirementData().yearsContributing);
    //3. Calculate bases of each salary
    const bases = salaries.map(income => this.contributionBase(data, income));
    //4. Calculate regulatory base with the information of each salary
    const regulatoryBase = this.regulatoryBase(bases);
    //5. Calculate the percentage that the person has the right to earn
    const percentage = this.retirementPercentage(data.retirementAge, data.yearsContributing, data.currentAge);
    //6. Calculate the monthly payment
    const monthlyRetirement = this.monthlyRetirementPayment(data.retirementAge, percentage, regulatoryBase, data.currentAge, data.yearsContributing, data.annualInflation);
    const monthlyRetirementInflation = monthlyRetirement;
    const objectiveInflation = data.annualInflation > 0 ? this.calculateInflation(data.retirementMonthlyObjective, (data.retirementAge - data.currentAge), data.annualInflation) : data.retirementMonthlyObjective;
    //7. Calculates if the person needs to have saves to get to the objective
    const isSavesNeeded = this.isSavesNeeded(monthlyRetirement, data.retirementMonthlyObjective, data.annualInflation, data.currentAge, data.retirementAge);
    //8. Calculates the future saves with the current saves monthly
    const compoundCalculator = this.compoundCalculator(data.currentSaves, data.currentSavesMonthly, data.currentReturn, data.currentAge, data.retirementAge, data.annualInflation);

    //9. If no need to save, return
    if (!isSavesNeeded) {
      return {
        data,
        monthlyRetirement,
        monthlyRetirementInflation,
        objectiveInflation,
        isSavesNeeded,
        savesNeeded: null,
        capitalNeeded: null,
        compoundCalculatorToReachGoal: null,
        compoundCalculator,
        percentageCovered: null,
        neededNewMonthlySaves: null
      }
    }

    //10. Calculates the saves needed
    const savesNeeded = this.savesNeeded(monthlyRetirement, data.retirementMonthlyObjective, data.annualInflation, data.currentAge, data.retirementAge);
    //11. Calculates the capital needed to be able to do 3% annual
    const capitalNeeded = this.capitalNeeded(savesNeeded);
    //12. Calculates the monthly saves to get to the objective with compound interest
    const compoundCalculatorToReachGoal = this.compoundCalculatorToReachGoal(capitalNeeded, data.currentSaves, data.currentSavesMonthly, data.currentAge, data.retirementAge, data.currentReturn, data.annualInflation);
    //13. Calculates the percentage cover by the current saves in the future
    const percentageCovered = this.percentageCovered(capitalNeeded, compoundCalculator);
    //14. Calculates the needed monthly saves diff
    const neededNewMonthlySaves = this.neededNewMonthlySaves(compoundCalculatorToReachGoal, data.currentSavesMonthly);

    return {
      data,
      monthlyRetirement,
      monthlyRetirementInflation,
      objectiveInflation,
      isSavesNeeded,
      savesNeeded,
      capitalNeeded,
      compoundCalculatorToReachGoal,
      compoundCalculator,
      percentageCovered,
      neededNewMonthlySaves
    }

  })

  /**
   * Calculates yearly salary increase
   * @param yearlyIncome number that represents the salary of the year
   * @param annualSalaryIncrease  number that represents the % increase yearly
   * @param currentAge number, the current age
   * @param retirementAge number, age of retirement
   * @param yearsContributing number, year contributing
   * @returns array of numbers that represents the salary of each year
   */
  projectSalaries(yearlyIncome: number, annualSalaryIncrease: number, currentAge: number, retirementAge: number, yearsContributing: number): number[] {
    const yearsLeft: number = retirementAge - currentAge;
    const totalYears: number = yearsLeft + yearsContributing;

    const salaries: number[] = [];

    for (let i: number = 0; i < totalYears; i++) {
      salaries.push(parseFloat(yearlyIncome.toFixed(2)));
      if (i >= (yearsContributing - 1) && annualSalaryIncrease > 0) {
        yearlyIncome *= (1 + (annualSalaryIncrease / 100));
      }
    }

    return salaries;
  }

  /**
   * Calculates the contribution base of a salary
   * @param retirementData signal that includes the form data
   * @param yearlyIncome number that represents the yearly income
   * @returns number that represents the contribution base
   */
  contributionBase(retirementData: RetirementData, yearlyIncome: number): number {

    const percentage = yearlyIncome * 0.28;
    const income = yearlyIncome / 12;

    let base = 0;

    if (retirementData.regime === RegimeType.AJENA) {

      const bases = { min: 1381.20, max: 4909.50 }

      if (income < bases.min) {
        base = bases.min;
      } else if (income > bases.max) {
        base = bases.max;
      } else {
        base = income;
      }

    } else {

      const reducedBases = {
        step_1: {
          condition: { min: 0, max: 670 },
          bases: { min: 653.59, max: 718.94 }
        },
        step_2: {
          condition: { min: 670, max: 900 },
          bases: { min: 718.95, max: 900 }
        },
        step_3: {
          condition: { min: 900, max: 1166.70 },
          bases: { min: 849.67, max: 1166.70 }
        }
      }

      const generalBases = {
        "step_1": {
          condition: { min: 1166.70, max: 1300 },
          bases: { min: 950.98, max: 1300 }
        },
        step_2: {
          condition: { min: 1300, max: 1500 },
          bases: { min: 960.78, max: 1500 }
        },
        step_3: {
          condition: { min: 1500, max: 1700 },
          bases: { min: 960.78, max: 1700 }
        },
        step_4: {
          condition: { min: 1700, max: 1850 },
          bases: { min: 1143.79, max: 1850 }
        },
        step_5: {
          condition: { min: 1850, max: 2030 },
          bases: { min: 1209.15, max: 2030 }
        },
        step_6: {
          condition: { min: 2030, max: 2330 },
          bases: { min: 1274.51, max: 2330 }
        },
        step_7: {
          condition: { min: 2330, max: 2760 },
          bases: { min: 1356.21, max: 2760 }
        },
        step_8: {
          condition: { min: 2760, max: 3190 },
          bases: { min: 1437.91, max: 3190 }
        },
        step_9: {
          condition: { min: 3190, max: 3620 },
          bases: { min: 1519.61, max: 3620 }
        },
        step_10: {
          condition: { min: 3620, max: 4050 },
          bases: { min: 1601.31, max: 4050 }
        },
        step_11: {
          condition: { min: 4050, max: 6000 },
          bases: { min: 1732.03, max: 4909.50 }
        },
        step_12: {
          condition: { min: 6000, max: Infinity },
          bases: { min: 1928.10, max: 4909.50 }
        }
      }

      //If the ammount earn is bigger than the last step in the reduced table,
      // then we search for the base in the general table.
      if (income > reducedBases.step_3.condition.max) {

        for (const step of Object.keys(generalBases) as Array<keyof typeof generalBases>) {

          const min: number = generalBases[step].condition.min;
          const max: number = generalBases[step].condition.max;
          const minBase: number = generalBases[step].bases.min;
          const maxBase: number = generalBases[step].bases.max;

          if (income >= min && income <= max) {

            base = (income === max) ? maxBase : minBase;

            break;
          }

        }

      } else {

        for (const step of Object.keys(reducedBases) as Array<keyof typeof reducedBases>) {

          const min: number = reducedBases[step].condition.min;
          const max: number = reducedBases[step].condition.max;
          const minBase: number = reducedBases[step].bases.min;
          const maxBase: number = reducedBases[step].bases.max;

          if (income >= min && income <= max) {

            base = (income === max) ? maxBase : minBase;

            break;
          }

        }

      }

    }

    return base;

  }

  /**
   * Calculates de regulatory bases of the last years
   * @param contributionBases number[] that represents the bases of each year
   * @returns number that represents the regulatory base
   */
  regulatoryBase(contributionBases: number[]): number {
    const contributionMonthlyBases: number[] = contributionBases.flatMap(monthlyBase => Array(12).fill(monthlyBase)) //Creates an array with all the monthlybases
    const lastMonths: number[] = contributionMonthlyBases.slice(-300);
    const sum: number = lastMonths.reduce((acc, val) => acc + val, 0);
    return parseFloat((sum / 300).toFixed(2));
  }

  /**
   * Calculates the percentage of the payment that the person has the right to earn
   * @param retirementAge `number` that represents the age of retirement
   * @param yearsContributing `number` that represents the years contributing
   * @param currentAge `number` that represents the current age
   * @returns `number` that represents the % of the payment that the person has the right to earn.
   */
  retirementPercentage(retirementAge: number, yearsContributing: number, currentAge: number): number {

    const date = new Date();
    const year = date.getFullYear();
    const yearsLeft = retirementAge - currentAge;
    const totalContributingYears = yearsContributing + yearsLeft;
    const totalContributingMonths = totalContributingYears * 12;
    const lawYear = year + yearsLeft;
    const isRightToRetire = totalContributingMonths >= 180 ? true : false;
    let percentage = 0;

    //If less than 15 years contributing
    if (!isRightToRetire) return percentage;

    //If has more than 15 years, already has the right to have 50%
    percentage += 50;

    if (lawYear === 2026) {

      const additionalMonths = totalContributingMonths - 180;

      if (additionalMonths > 0) {
        const additionalFirstPercentage = additionalMonths <= 49 ? parseFloat((additionalMonths * 0.21).toFixed(2)) : parseFloat((49 * 0.21).toFixed(2));
        const additionalSecondPercentage = (additionalMonths - 49) > 0 ? parseFloat(((additionalMonths - 49) * 0.19).toFixed(2)) : 0;
        percentage += (additionalFirstPercentage + additionalSecondPercentage)
      }

    } else {

      const additionalMonths = totalContributingMonths - 180;

      if (additionalMonths > 0) {
        const additionalFirstPercentage = additionalMonths <= 248 ? parseFloat((additionalMonths * 0.19).toFixed(2)) : parseFloat((248 * 0.19).toFixed(2));
        const additionalSecondPercentage = (additionalMonths - 248) > 0 ? parseFloat(((additionalMonths - 248) * 0.18).toFixed(2)) : 0;
        percentage += (additionalFirstPercentage + additionalSecondPercentage)
      }

    }

    return Math.min(percentage, 100);

  }

  /**
   * Calculates the monthly payment based on the percentage and the year the person wants to retire
   * @param retirementAge `number` that represents the age that the person is retired
   * @param retirementPercentage `number` that represents the % of the retirement that this person has the right to earn
   * @param regulatoryBase `number` that represents the base that has to be applied to the percentages
   * @param currentAge `number` that represents the current person age
   * @param yearsContributing `number` that represents the contribution years of that person.
   * @param annualInflation `number` that represents the inflation each year
   * @returns `number` that represents the monthly payment adjust by inflation
   */
  monthlyRetirementPayment(retirementAge: number, retirementPercentage: number, regulatoryBase: number, currentAge: number, yearsContributing: number, annualInflation: number): number {

    const remainingYears = retirementAge - currentAge;
    let monthlyRetirementPayment = 0;

    if (retirementAge >= 65) {
      monthlyRetirementPayment = regulatoryBase * (retirementPercentage / 100);
      return annualInflation > 0 ? parseFloat((monthlyRetirementPayment * Math.pow(1 + (annualInflation / 100), remainingYears)).toFixed(2)) : parseFloat(monthlyRetirementPayment.toFixed(2));
    }

    const totalContributingYears = (retirementAge - currentAge) + yearsContributing;

    switch (true) {

      case totalContributingYears < 38:
        monthlyRetirementPayment = retirementAge === 63 ? parseFloat(((regulatoryBase * (retirementPercentage / 100)) * (1 - 0.21)).toFixed(2)) : parseFloat(((regulatoryBase * (retirementPercentage / 100)) * (1 - 0.0550)).toFixed(2));
        break;

      case totalContributingYears >= 38 && totalContributingYears < 41:
        monthlyRetirementPayment = retirementAge === 63 ? parseFloat(((regulatoryBase * (retirementPercentage / 100)) * (1 - 0.19)).toFixed(2)) : parseFloat(((regulatoryBase * (retirementPercentage / 100)) * (1 - 0.0525)).toFixed(2));
        break;

      case totalContributingYears >= 41 && totalContributingYears < 44:
        monthlyRetirementPayment = retirementAge === 63 ? parseFloat(((regulatoryBase * (retirementPercentage / 100)) * (1 - 0.17)).toFixed(2)) : parseFloat(((regulatoryBase * (retirementPercentage / 100)) * (1 - 0.05)).toFixed(2));
        break;

      case totalContributingYears >= 44:
        monthlyRetirementPayment = retirementAge === 63 ? parseFloat(((regulatoryBase * (retirementPercentage / 100)) * (1 - 0.13)).toFixed(2)) : parseFloat(((regulatoryBase * (retirementPercentage / 100)) * (1 - 0.475)).toFixed(2));
        break;
    }

    return annualInflation > 0 ? parseFloat((monthlyRetirementPayment * Math.pow(1 + (annualInflation / 100), remainingYears)).toFixed(2)) : parseFloat(monthlyRetirementPayment.toFixed(2));

  }

  /**
   * Calculates if the person needs saves in order to fullfill the objective
   * @param monthlyRetirementPayment `number` that represents the retirement payment each month
   * @param retirementMonthlyObjective `number` that represents the retirement payment that the person wants to have
   * @param annualInflation `number` that represents the annual inflation
   * @param currentAge `number` that represents the current age of the user
   * @param retirementAge `number` that represents the age of retirement
   * @returns `boolean` that represents if the user needs to have saves to get to the objective
   */
  isSavesNeeded(monthlyRetirementPayment: number, retirementMonthlyObjective: number, annualInflation: number, currentAge: number, retirementAge: number): boolean {

    const yearsUntilRetirement = retirementAge - currentAge;

    const adjustedObjective = retirementMonthlyObjective * Math.pow(1 + (annualInflation / 100), yearsUntilRetirement);

    const adjustedMonthlyPension = (monthlyRetirementPayment * 14) / 12;

    if (adjustedMonthlyPension >= adjustedObjective) return false;

    return true;
  }

  /**
   * Calculates the saves needed in order to get to the objective once retire
   * @param monthlyRetirementPayment `number` retirement monthly payment
   * @param retirementMonthlyObjective `number` objective monthly
   * @param annualInflation `number` inflation
   * @param currentAge `number`
   * @param retirementAge `number`
   * @returns `number` represents the saves needed in order to get to the objective once retire
   */
  savesNeeded(monthlyRetirementPayment: number, retirementMonthlyObjective: number, annualInflation: number, currentAge: number, retirementAge: number): number {

    const yearsUntilRetirement = retirementAge - currentAge;

    const adjustedObjective = retirementMonthlyObjective * Math.pow(1 + (annualInflation / 100), yearsUntilRetirement);

    const adjustedMonthlyPension = (monthlyRetirementPayment * 14) / 12;

    const monthlyRest = adjustedObjective - adjustedMonthlyPension;

    return parseFloat((monthlyRest * 12).toFixed(2))
  }

  /**
   * Calculates the capital needed with the 3% rule in order to get to the objective
   * @param savesNeeded `number` saves needed before retire
   * @returns `number` represents the capital needed to be able to retire 3%
   */
  capitalNeeded(savesNeeded: number): number {

    const capital = savesNeeded * ((1 - Math.pow((1 + (3 / 100)), -25)) / (3 / 100));

    return parseFloat(capital.toFixed(2))
  }

  /**
   * Calculates how much saves the person is going to have with the compound interest
   * @param currentSaves `number` that represents the current saves that the user has
   * @param currentSavesMonthly `number` that represents the current saves that the user has
   * @param currentReturn `number` that represents the current annual return
   * @param currentAge `number` that represents the current age
   * @param retirementAge `number` that represents the retirement age
   * @param annualInflation `number` that represents the annual inflation
   * @returns `number` that represents the total earn with the compound interest
   */
  compoundCalculator(currentSaves: number, currentSavesMonthly: number, currentReturn: number, currentAge: number, retirementAge: number, annualInflation: number): number {

    const interest = currentReturn / 100
    const inflation = annualInflation / 100;
    const months = (retirementAge - currentAge) * 12;

    if (currentReturn === 0) {
      const futureValueSavings = currentSaves;
      const futureValueContributions = currentSavesMonthly * months;
      const total = parseFloat((futureValueSavings + futureValueContributions).toFixed(2));
      return total;
    }

    const monthlyAdjustedReturn = (((1 + interest) / (1 + inflation)) - 1) / 12;

    if (Math.abs(monthlyAdjustedReturn) < 0.0001) {
      const futureValueSavings = currentSaves;
      const futureValueContributions = currentSavesMonthly * months;
      const total = parseFloat((futureValueSavings + futureValueContributions).toFixed(2));
      return total;
    }

    const futureValueSavings = currentSaves * Math.pow(1 + monthlyAdjustedReturn, months);
    const futureValueContributions = currentSavesMonthly * ((Math.pow(1 + monthlyAdjustedReturn, months) - 1) / monthlyAdjustedReturn);
    const total = parseFloat((futureValueSavings + futureValueContributions).toFixed(2));

    return total;
  }

  /**
   * Calculates the monthly saves that the person needs to get to an objective
   * @param targetSavings `number`
   * @param currentSaves `number`
   * @param currentMonthlyContribution `number`
   * @param currentAge `number`
   * @param retirementAge `number`
   * @param currentReturn `number`
   * @param annualInflation `number`
   * @returns `number` monthly saves to get to the objective
   */
  compoundCalculatorToReachGoal(targetSavings: number, currentSaves: number, currentMonthlyContribution: number, currentAge: number, retirementAge: number, currentReturn: number, annualInflation: number): number {

    const interest = currentReturn / 100;
    const inflation = annualInflation / 100;
    const months = (retirementAge - currentAge) * 12;

    if (currentReturn === 0) {
      const futureValueSavings = currentSaves;
      const futureValueContributions = currentMonthlyContribution * months;
      const projectedTotal = futureValueSavings + futureValueContributions;
      
      if (projectedTotal >= targetSavings) {
        const remainingNeededFromContributions = targetSavings - currentSaves;
        if (remainingNeededFromContributions <= 0) return 0;
        const minimumMonthlyContribution = remainingNeededFromContributions / months;
        return parseFloat(minimumMonthlyContribution.toFixed(2));
      }
      
      const remainingNeeded = targetSavings - projectedTotal;
      const additionalMonthlyContribution = remainingNeeded / months;
      const totalMonthlyContribution = currentMonthlyContribution + additionalMonthlyContribution;
      
      return parseFloat(totalMonthlyContribution.toFixed(2));
    }

    //Return adjusted by inflation
    const monthlyAdjustedReturn = (((1 + interest) / (1 + inflation)) - 1) / 12;

    if (Math.abs(monthlyAdjustedReturn) < 0.0001) {
      const futureValueSavings = currentSaves;
      const futureValueContributions = currentMonthlyContribution * months;
      const projectedTotal = futureValueSavings + futureValueContributions;
      
      if (projectedTotal >= targetSavings) {
        const remainingNeededFromContributions = targetSavings - currentSaves;
        if (remainingNeededFromContributions <= 0) return 0;
        const minimumMonthlyContribution = remainingNeededFromContributions / months;
        return parseFloat(minimumMonthlyContribution.toFixed(2));
      }
      
      const remainingNeeded = targetSavings - projectedTotal;
      const additionalMonthlyContribution = remainingNeeded / months;
      const totalMonthlyContribution = currentMonthlyContribution + additionalMonthlyContribution;
      
      return parseFloat(totalMonthlyContribution.toFixed(2));
    }

    //Future value actual savings
    const futureValueSavings = currentSaves * Math.pow(1 + monthlyAdjustedReturn, months);

    //Future value monthly savings
    const futureValueContributions = currentMonthlyContribution * ((Math.pow(1 + monthlyAdjustedReturn, months) - 1) / monthlyAdjustedReturn);

    //Total projected
    const projectedTotal = futureValueSavings + futureValueContributions;

    if (projectedTotal >= targetSavings) {
      // Calculate minimum monthly contribution needed
      const futureValueSavingsOnly = currentSaves * Math.pow(1 + monthlyAdjustedReturn, months);
      if (futureValueSavingsOnly >= targetSavings) return 0;
      
      const remainingNeededFromContributions = targetSavings - futureValueSavingsOnly;
      const minimumMonthlyContribution = remainingNeededFromContributions * monthlyAdjustedReturn / (Math.pow(1 + monthlyAdjustedReturn, months) - 1);
      
      return parseFloat(minimumMonthlyContribution.toFixed(2));
    }

    //What needs to save additional
    const remainingNeeded = targetSavings - projectedTotal;

    const additionalMonthlyContribution = remainingNeeded * monthlyAdjustedReturn / (Math.pow(1 + monthlyAdjustedReturn, months) - 1);
    const totalMonthlyContribution = currentMonthlyContribution + additionalMonthlyContribution;

    return parseFloat(totalMonthlyContribution.toFixed(2));

  }

  /**
   * Calculates the percentage covered by the current saves to get to an objective
   * @param capitalNeeded `number`
   * @param currentObjectiveSaves `number`
   * @returns `number`
   */
  percentageCovered(capitalNeeded: number, currentObjectiveSaves: number): number {

    const percentage = parseFloat(((currentObjectiveSaves / capitalNeeded) * 100).toFixed(2))

    return percentage;
  }

  /**
   * Calculates the diff between what is saving right now and what the person needs to save to get to the objective
   * @param neededSavesMonthly `number`
   * @param currentSavesMonthly `number`
   * @returns `number`
   */
  neededNewMonthlySaves(neededSavesMonthly: number, currentSavesMonthly: number): number {
    const newSaves = parseFloat((neededSavesMonthly - currentSavesMonthly).toFixed(2));

    return newSaves;
  }

  /**
   * Calculates the inflation
   * @param initialAmmount `number`
   * @param years `number`
   * @param inflation `number`
   * @returns `number`
   */
  calculateInflation(initialAmmount: number, years: number, inflation: number): number {
    return initialAmmount * Math.pow(1 + (inflation / 100), years);
  }
}
