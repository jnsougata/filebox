package deta

import (
	"strings"
)

type deta struct {
	service *service
}

func (d *deta) Base(name string) *Base {
	return &Base{Name: name, service: d.service}
}

func (d *deta) Drive(name string) *drive {
	return &drive{Name: name, service: d.service}
}

func New(key string) *deta {
	fragments := strings.Split(key, "_")
	if len(fragments) != 2 {
		panic("invalid project key is given")
	}
	service := service{key: key, projectId: fragments[0]}
	return &deta{service: &service}
}
