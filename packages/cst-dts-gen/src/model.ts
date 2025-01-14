import {
  Alternation,
  Alternative,
  GAstVisitor,
  IProduction,
  NonTerminal,
  Option,
  Repetition,
  RepetitionMandatory,
  RepetitionMandatoryWithSeparator,
  RepetitionWithSeparator,
  Rule,
  Terminal,
  TokenType
} from "chevrotain"
import map from "lodash/map"
import flatten from "lodash/flatten"
import values from "lodash/values"
import some from "lodash/some"
import groupBy from "lodash/groupBy"
import assign from "lodash/assign"

export function buildModel(
  productions: Record<string, Rule>
): CstNodeTypeDefinition[] {
  const generator = new CstNodeDefinitionGenerator()
  const allRules = values(productions)
  return map(allRules, (rule) => generator.visitRule(rule))
}

export type CstNodeTypeDefinition = {
  name: string
  properties: PropertyTypeDefinition[]
}

export type PropertyTypeDefinition = {
  name: string
  type: PropertyArrayType
  optional: boolean
}

export type PropertyArrayType = TokenArrayType | RuleArrayType
export type TokenArrayType = { kind: "token" }
export type RuleArrayType = {
  kind: "rule"
  name: string
}

class CstNodeDefinitionGenerator extends GAstVisitor {
  visitRule(node: Rule): CstNodeTypeDefinition {
    const rawElements = this.visitEach(node.definition)

    const grouped = groupBy(rawElements, (el) => el.propertyName)
    const properties = map(grouped, (group, propertyName) => {
      const allNullable = !some(group, (el) => !el.canBeNull)
      return {
        name: propertyName,
        type: group[0].type,
        optional: allNullable
      } as PropertyTypeDefinition
    })

    return {
      name: node.name,
      properties: properties
    }
  }

  visitAlternative(node: Alternative) {
    return this.visitEachAndOverrideWith(node.definition, { canBeNull: true })
  }

  visitOption(node: Option) {
    return this.visitEachAndOverrideWith(node.definition, { canBeNull: true })
  }

  visitRepetition(node: Repetition) {
    return this.visitEachAndOverrideWith(node.definition, { canBeNull: true })
  }

  visitRepetitionMandatory(node: RepetitionMandatory) {
    return this.visitEach(node.definition)
  }

  visitRepetitionMandatoryWithSeparator(
    node: RepetitionMandatoryWithSeparator
  ) {
    return this.visitEach(node.definition).concat({
      propertyName: node.separator.name,
      canBeNull: true,
      type: getType(node.separator)
    })
  }

  visitRepetitionWithSeparator(node: RepetitionWithSeparator) {
    return this.visitEachAndOverrideWith(node.definition, {
      canBeNull: true
    }).concat({
      propertyName: node.separator.name,
      canBeNull: true,
      type: getType(node.separator)
    })
  }

  visitAlternation(node: Alternation) {
    return this.visitEachAndOverrideWith(node.definition, { canBeNull: true })
  }

  visitTerminal(node: Terminal): PropertyTupleElement[] {
    return [
      {
        propertyName: node.label || node.terminalType.name,
        canBeNull: false,
        type: getType(node)
      }
    ]
  }

  visitNonTerminal(node: NonTerminal): PropertyTupleElement[] {
    return [
      {
        propertyName: node.label || node.nonTerminalName,
        canBeNull: false,
        type: getType(node)
      }
    ]
  }

  private visitEachAndOverrideWith(
    definition: IProduction[],
    override: Partial<PropertyTupleElement>
  ) {
    return map(
      this.visitEach(definition),
      (definition) => assign({}, definition, override) as PropertyTupleElement
    )
  }

  private visitEach(definition: IProduction[]) {
    return flatten<PropertyTupleElement>(
      map(
        definition,
        (definition) => this.visit(definition) as PropertyTupleElement[]
      )
    )
  }
}

type PropertyTupleElement = {
  propertyName: string
  canBeNull: boolean
  type: PropertyArrayType
}

function getType(
  production: Terminal | NonTerminal | TokenType
): PropertyArrayType {
  if (production instanceof NonTerminal) {
    return {
      kind: "rule",
      name: production.referencedRule.name
    }
  }

  return { kind: "token" }
}
