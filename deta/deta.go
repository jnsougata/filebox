package deta

import (
	"os"
	"strings"
)


type deta struct {
	service *service
}

func (d *deta) Base(name string) *base {
	return &base{Name: name, service: d.service}
}

func (d *deta) Drive(name string) *drive {
	return &drive{Name: name, service: d.service}
}

func New(key interface{}) *deta {
	var pk string
	if key != nil {
		pk = key.(string)
	} else {
		pk = os.Getenv("DETA_PROJECT_KEY")
		if pk == "" {
			panic("project key is not found in the env")
		}
	}
	fragments := strings.Split(pk, "_")
	if len(fragments) != 2 {
		panic("invalid project key is given")
	}
	service := service{key: pk, projectId: fragments[0]}
	return &deta{service: &service}
}