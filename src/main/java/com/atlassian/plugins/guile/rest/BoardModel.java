package com.atlassian.plugins.guile.rest;

import org.codehaus.jackson.annotate.JsonIgnoreProperties;

import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlRootElement;

@JsonIgnoreProperties(ignoreUnknown = true)
@XmlRootElement(name = "result")
@XmlAccessorType(XmlAccessType.FIELD)
public class BoardModel {

	@XmlElement(name = "id")
	private int id;
	public int getId() { return id; }
	public void setId(int id) { this.id = id; }

	@XmlElement(name = "name")
	private String name;
	public String getName() { return name; }
	public void setName(String name) { this.name = name; }

}
