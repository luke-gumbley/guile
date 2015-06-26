package com.atlassian.plugins.guile.rest;

import org.codehaus.jackson.annotate.JsonIgnoreProperties;
import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlRootElement;

@JsonIgnoreProperties(ignoreUnknown = true)
@XmlRootElement(name = "result")
@XmlAccessorType(XmlAccessType.FIELD)
public class SprintModel {

	@XmlElement(name = "id")
	private int id;
	public int getId() { return id; }
	public void setId(int id) { this.id = id; }

	@XmlElement(name = "sequence")
	private int sequence;
	public int getSequence() { return sequence; }
	public void setSequence(int sequence) { this.sequence = sequence; }

	@XmlElement(name = "name")
	private String name;
	public String getName() { return name; }
	public void setName(String name) { this.name = name; }

	@XmlElement(name = "state")
	private String state;
	public String getState() { return state; }
	public void setState(String state) { this.state = state; }

}
