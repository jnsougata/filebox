package main

import (
	"fmt"
	"os"
	"strings"
)

func MatchProjectId(id string) bool {
	return strings.HasPrefix(os.Getenv("DETA_API_KEY"), id)
}

func MatchPassword(password string) bool {
	return password == os.Getenv("USER_PASSWORD")
}

func FileToDriveSavedName(file map[string]interface{}) string {
	hash := file["hash"].(string)
	fragment := strings.Split(file["name"].(string), ".")
	var driveFilename string
	if len(fragment) > 1 {
		driveFilename = fmt.Sprintf("%s.%s", hash, fragment[len(fragment)-1])
	} else {
		driveFilename = hash
	}
	return driveFilename
}

func FolderToAsParentPath(folder map[string]interface{}) string {
	var path string
	_, ok := folder["parent"]
	if ok {
		path = folder["parent"].(string) + "/" + folder["name"].(string)
	} else {
		path = folder["name"].(string)
	}
	return path
}