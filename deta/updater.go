package deta

type Updater struct {
	Key     string
	updates map[string]interface{}
}

func NewUpdater(key string) *Updater {
	if key == "" {
		panic("key cannot be empty")
	}
	return &Updater{
		Key: key,
		updates: map[string]interface{}{
			"delete":    []string{},
			"set":       map[string]interface{}{},
			"append":    map[string]interface{}{},
			"prepend":   map[string]interface{}{},
			"increment": map[string]interface{}{},
		},
	}
}

func (u *Updater) Set(field string, value interface{}) {
	u.updates["set"].(map[string]interface{})[field] = value
}

func (u *Updater) Delete(fields ...string) {
	u.updates["delete"] = append(u.updates["delete"].([]string), fields...)
}

func (u *Updater) Increment(field string, value interface{}) {
	u.updates["increment"].(map[string]interface{})[field] = value
}

func (u *Updater) Append(field string, value []interface{}) {
	u.updates["append"].(map[string]interface{})[field] = value
}

func (u *Updater) Prepend(field string, value []interface{}) {
	u.updates["prepend"].(map[string]interface{})[field] = value
}
