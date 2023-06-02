package deta

import (
	"os"
	"strings"
)


type deta struct {
	service *service
}

// Base returns the pointer to a new base instance
func (d *deta) Base(name string) *base {
	return &base{Name: name, service: d.service}
}

// Drive returns the pointer to a new drive instance
func (d *deta) Drive(name string) *drive {
	return &drive{Name: name, service: d.service}
}

// New returns the pointer to a new deta instance.
// args is used to pass the project key as a string.
// Only the first argument is used and the rest are ignored. 
// Variadic arguments are used to make it easier to optionally pass the project key.
// If not passed, it will try to read from the environment variable DETA_PROJECT_KEY
func New(key interface{}) *deta {
	var pk string
	if key != nil {
		pk = key.(string)
	} else {
		pk = os.Getenv("DETA_PROJECT_KEY")
		if pk == "" {
			panic("project key is not found in the env, visit https://web.deta.sh")
		}
	}
	fragments := strings.Split(pk, "_")
	if len(fragments) != 2 {
		panic("invalid project key is given, visit https://web.deta.sh")
	}
	service := service{key: pk, projectId: fragments[0]}
	return &deta{service: &service}
}