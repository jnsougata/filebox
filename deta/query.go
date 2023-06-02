package deta

import (
	"fmt"
)

type Query struct {
	Last  string // Last is the last key of the previous query
	Limit int    // Limit is the maximum number of items to return
	Value []map[string]interface{}
}

func NewQuery() *Query {
	q := Query{
		Last: "",
		Limit: 1000,
		Value: []map[string]interface{}{{}},
	}
	return &q
}

func (q *Query) Equals(field string, value interface{}) {
	q.Value[0][field] = value
}

func (q *Query) NotEquals(field string, value interface{}) {
	q.Value[0][fmt.Sprintf("%s?ne", field)] = value
}

func (q *Query) GreaterThan(field string, value interface{}) {
	q.Value[0][fmt.Sprintf("%s?gt", field)] = value
}

func (q *Query) GreaterThanOrEqual(field string, value interface{}) {
	q.Value[0][fmt.Sprintf("%s?gte", field)] = value
}

func (q *Query) LessThan(field string, value interface{}) {
	q.Value[0][fmt.Sprintf("%s?lt", field)] = value
}

func (q *Query) LessThanOrEqual(field string, value interface{}) {
	q.Value[0][fmt.Sprintf("%s?lte", field)] = value
}

func (q *Query) Prefix(field string, prefix string) {
	q.Value[0][fmt.Sprintf("%s?pfx", field)] = prefix
}

func (q *Query) Range(field string, start interface{}, end interface{}) {
	q.Value[0][fmt.Sprintf("%s?r", field)] = []interface{}{start, end}
}

func (q *Query) Contains(field, substring string) {
	q.Value[0][fmt.Sprintf("%s?contains", field)] = substring
}

func (q *Query) NotContains(field, substring string) {
	q.Value[0][fmt.Sprintf("%s?not_contains", field)] = substring
}

func (q *Query) Union(queries ...Query) {
	for _, query := range queries {
		q.Value = append(q.Value, query.Value...)
	}
}
